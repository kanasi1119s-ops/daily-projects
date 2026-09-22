'use strict';

// Data store for PulseBoard.
//
// State lives in memory (as before) but, when a `persistPath` is given, is
// also mirrored to a local JSON file on disk (see server/persistence.js) so
// monitors/checks/incidents/plan survive a server restart. With no
// `persistPath` the store behaves exactly as the original in-memory-only
// store (this is what the test suite uses by default, so tests stay fast
// and isolated from the filesystem).
//
// Two uptime numbers are tracked per monitor:
//  - `uptimePct`: the original rolling-window % over the last
//    MAX_CHECKS_PER_MONITOR checks (fine-grained, but short-lived — at the
//    default 15s check interval that's ~12 minutes of history).
//  - `uptimeStats`: long-term aggregates built from small, bounded daily
//    up/down tallies (not per-check history) plus an all-time running
//    total, so "uptime last 24h / 7d / 30d / all-time" survives restarts
//    without storing unbounded history. See decorateMonitor() below.

const persistence = require('./persistence');

const FREE_PLAN_MONITOR_LIMIT = 3;
const MAX_CHECKS_PER_MONITOR = 50;
const MAX_INCIDENTS = 100;
// Daily rollup buckets are kept per monitor, one per UTC calendar day, for
// this many days — bounded size regardless of check frequency or how long
// a monitor has existed (a few dozen bytes per day, not per check).
const MAX_DAILY_BUCKETS = 90;
// Per-monitor check interval override bounds: never allow a target to be
// hammered faster than every 5s, and never let a single monitor go longer
// than 24h between checks (mostly a sanity bound).
const MIN_MONITOR_INTERVAL_MS = 5000;
const MAX_MONITOR_INTERVAL_MS = 24 * 60 * 60 * 1000;

class ValidationError extends Error {}
class PlanLimitError extends Error {}

function dayKeyFromIso(iso) {
  // 'YYYY-MM-DDTHH:mm:ss.sssZ' -> 'YYYY-MM-DD' (UTC calendar day).
  return (iso || new Date().toISOString()).slice(0, 10);
}

function pctFromCounts(up, down) {
  const total = up + down;
  return total ? Math.round((up / total) * 1000) / 10 : null;
}

function validateWebhookUrl(webhookUrl) {
  if (webhookUrl === undefined || webhookUrl === null || webhookUrl === '') return null;
  if (typeof webhookUrl !== 'string' || !/^https?:\/\/\S+/i.test(webhookUrl.trim())) {
    throw new ValidationError('webhookUrl must be a valid http:// or https:// address, or omitted');
  }
  return webhookUrl.trim();
}

function validateIntervalMs(intervalMs) {
  if (intervalMs === undefined || intervalMs === null || intervalMs === '') return null;
  const n = Number(intervalMs);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new ValidationError('intervalMs must be a whole number of milliseconds, or omitted');
  }
  if (n < MIN_MONITOR_INTERVAL_MS || n > MAX_MONITOR_INTERVAL_MS) {
    throw new ValidationError(
      `intervalMs must be between ${MIN_MONITOR_INTERVAL_MS} and ${MAX_MONITOR_INTERVAL_MS} (5s-24h), or omitted to use the global default`
    );
  }
  return n;
}

function createStore(options = {}) {
  const persistPath = options.persistPath || null;

  let monitors = [];
  let checksByMonitor = new Map(); // monitorId -> array of check results, oldest first
  let dailyStatsByMonitor = new Map(); // monitorId -> Map(dateKey -> { up, down })
  let allTimeStatsByMonitor = new Map(); // monitorId -> { up, down }
  let incidents = [];
  let plan = 'free'; // 'free' | 'pro'
  let nextMonitorId = 1;
  let nextIncidentId = 1;

  function persist() {
    if (!persistPath) return;
    persistence.saveSync(persistPath, {
      monitors,
      checksByMonitor: Array.from(checksByMonitor.entries()),
      dailyStatsByMonitor: Array.from(dailyStatsByMonitor.entries()).map(([id, dayMap]) => [id, Array.from(dayMap.entries())]),
      allTimeStatsByMonitor: Array.from(allTimeStatsByMonitor.entries()),
      incidents,
      plan,
      nextMonitorId,
      nextIncidentId,
    });
  }

  function loadFromDisk() {
    if (!persistPath) return;
    const data = persistence.loadSync(persistPath);
    if (!data) return;
    monitors = Array.isArray(data.monitors) ? data.monitors : [];
    checksByMonitor = new Map(Array.isArray(data.checksByMonitor) ? data.checksByMonitor : []);
    dailyStatsByMonitor = new Map(
      (Array.isArray(data.dailyStatsByMonitor) ? data.dailyStatsByMonitor : []).map(([id, entries]) => [id, new Map(entries)])
    );
    allTimeStatsByMonitor = new Map(Array.isArray(data.allTimeStatsByMonitor) ? data.allTimeStatsByMonitor : []);
    incidents = Array.isArray(data.incidents) ? data.incidents : [];
    plan = data.plan === 'pro' ? 'pro' : 'free';
    nextMonitorId = Number.isInteger(data.nextMonitorId) ? data.nextMonitorId : 1;
    nextIncidentId = Number.isInteger(data.nextIncidentId) ? data.nextIncidentId : 1;
  }

  loadFromDisk();

  function recentDayKeys(count, fromDate = new Date()) {
    const keys = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(fromDate);
      d.setUTCDate(d.getUTCDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    return keys;
  }

  function sumDailyStats(monitorId, dayKeys) {
    const dayMap = dailyStatsByMonitor.get(monitorId);
    let up = 0;
    let down = 0;
    if (dayMap) {
      for (const key of dayKeys) {
        const bucket = dayMap.get(key);
        if (bucket) {
          up += bucket.up;
          down += bucket.down;
        }
      }
    }
    return { up, down };
  }

  function computeUptimeStats(monitorId) {
    const now = new Date();
    const today1 = sumDailyStats(monitorId, recentDayKeys(1, now));
    const last7 = sumDailyStats(monitorId, recentDayKeys(7, now));
    const last30 = sumDailyStats(monitorId, recentDayKeys(30, now));
    const allTime = allTimeStatsByMonitor.get(monitorId) || { up: 0, down: 0 };
    return {
      // Day-granularity (UTC calendar day), built from bounded daily
      // rollups rather than unbounded per-check history — see module
      // header comment. "last24h" is today's UTC bucket, not a strict
      // trailing 24h window.
      last24h: { pct: pctFromCounts(today1.up, today1.down), upChecks: today1.up, downChecks: today1.down },
      last7d: { pct: pctFromCounts(last7.up, last7.down), upChecks: last7.up, downChecks: last7.down },
      last30d: { pct: pctFromCounts(last30.up, last30.down), upChecks: last30.up, downChecks: last30.down },
      allTime: { pct: pctFromCounts(allTime.up, allTime.down), upChecks: allTime.up, downChecks: allTime.down },
    };
  }

  function recordDailyStat(monitorId, ok, timestamp) {
    const key = dayKeyFromIso(timestamp);
    let dayMap = dailyStatsByMonitor.get(monitorId);
    if (!dayMap) {
      dayMap = new Map();
      dailyStatsByMonitor.set(monitorId, dayMap);
    }
    const bucket = dayMap.get(key) || { up: 0, down: 0 };
    if (ok) bucket.up += 1;
    else bucket.down += 1;
    dayMap.set(key, bucket);

    // Bound the number of daily buckets kept per monitor — prune anything
    // older than MAX_DAILY_BUCKETS calendar days.
    if (dayMap.size > MAX_DAILY_BUCKETS) {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - MAX_DAILY_BUCKETS);
      const cutoffKey = cutoff.toISOString().slice(0, 10);
      for (const dateKey of dayMap.keys()) {
        if (dateKey < cutoffKey) dayMap.delete(dateKey);
      }
    }

    const allTime = allTimeStatsByMonitor.get(monitorId) || { up: 0, down: 0 };
    if (ok) allTime.up += 1;
    else allTime.down += 1;
    allTimeStatsByMonitor.set(monitorId, allTime);
  }

  function decorateMonitor(m) {
    const checks = checksByMonitor.get(m.id) || [];
    const last = checks[checks.length - 1] || null;
    const upCount = checks.filter((c) => c.ok).length;
    const uptimePct = checks.length ? Math.round((upCount / checks.length) * 1000) / 10 : null;
    return {
      id: m.id,
      name: m.name,
      url: m.url,
      createdAt: m.createdAt,
      webhookUrl: m.webhookUrl || null,
      intervalMs: m.intervalMs || null,
      status: last ? (last.ok ? 'up' : 'down') : 'pending',
      lastCheckedAt: last ? last.timestamp : null,
      lastResponseTimeMs: last ? last.responseTimeMs : null,
      lastStatusCode: last ? last.statusCode : null,
      lastError: last ? last.error : null,
      uptimePct,
      checkCount: checks.length,
      uptimeStats: computeUptimeStats(m.id),
    };
  }

  function listMonitors() {
    return monitors.map(decorateMonitor);
  }

  function getMonitor(id) {
    const m = monitors.find((x) => x.id === id);
    return m ? decorateMonitor(m) : null;
  }

  function getRawMonitor(id) {
    return monitors.find((x) => x.id === id) || null;
  }

  function addMonitor({ name, url, webhookUrl, intervalMs } = {}) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('name is required');
    }
    if (!url || typeof url !== 'string' || !/^https?:\/\/\S+/i.test(url.trim())) {
      throw new ValidationError('url must be a valid http:// or https:// address');
    }
    const cleanWebhookUrl = validateWebhookUrl(webhookUrl);
    const cleanIntervalMs = validateIntervalMs(intervalMs);
    const limit = plan === 'pro' ? Infinity : FREE_PLAN_MONITOR_LIMIT;
    if (monitors.length >= limit) {
      throw new PlanLimitError(
        `Free plan is limited to ${FREE_PLAN_MONITOR_LIMIT} monitors. Upgrade to Pro to add more (demo upgrade, no real payment).`
      );
    }
    const monitor = {
      id: nextMonitorId++,
      name: name.trim(),
      url: url.trim(),
      webhookUrl: cleanWebhookUrl,
      intervalMs: cleanIntervalMs,
      createdAt: new Date().toISOString(),
    };
    monitors.push(monitor);
    checksByMonitor.set(monitor.id, []);
    dailyStatsByMonitor.set(monitor.id, new Map());
    allTimeStatsByMonitor.set(monitor.id, { up: 0, down: 0 });
    persist();
    return decorateMonitor(monitor);
  }

  function updateMonitor(id, updates = {}) {
    const monitor = getRawMonitor(id);
    if (!monitor) return null;
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) {
        throw new ValidationError('name must be a non-empty string');
      }
      monitor.name = updates.name.trim();
    }
    if (updates.url !== undefined) {
      if (typeof updates.url !== 'string' || !/^https?:\/\/\S+/i.test(updates.url.trim())) {
        throw new ValidationError('url must be a valid http:// or https:// address');
      }
      monitor.url = updates.url.trim();
    }
    if (updates.webhookUrl !== undefined) {
      monitor.webhookUrl = validateWebhookUrl(updates.webhookUrl);
    }
    if (updates.intervalMs !== undefined) {
      monitor.intervalMs = validateIntervalMs(updates.intervalMs);
    }
    persist();
    return decorateMonitor(monitor);
  }

  function removeMonitor(id) {
    const idx = monitors.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    monitors.splice(idx, 1);
    checksByMonitor.delete(id);
    dailyStatsByMonitor.delete(id);
    allTimeStatsByMonitor.delete(id);
    persist();
    return true;
  }

  function recordCheck(id, result) {
    const monitor = getRawMonitor(id);
    if (!monitor) return null;
    const checks = checksByMonitor.get(id) || [];
    const previous = checks[checks.length - 1] || null;

    checks.push(result);
    if (checks.length > MAX_CHECKS_PER_MONITOR) checks.shift();
    checksByMonitor.set(id, checks);
    recordDailyStat(id, result.ok, result.timestamp);

    const wasUp = previous ? previous.ok : null;
    const isFirstCheck = previous === null;
    const flippedState = !isFirstCheck && wasUp !== result.ok;
    const firstCheckIsDown = isFirstCheck && !result.ok;

    if (flippedState || firstCheckIsDown) {
      incidents.unshift({
        id: nextIncidentId++,
        monitorId: id,
        monitorName: monitor.name,
        type: result.ok ? 'recovered' : 'down',
        timestamp: result.timestamp,
      });
      incidents = incidents.slice(0, MAX_INCIDENTS);
    }

    persist();
    return decorateMonitor(monitor);
  }

  function listIncidents() {
    return incidents;
  }

  function getPlan() {
    return plan;
  }

  function setPlan(p) {
    if (p !== 'free' && p !== 'pro') throw new ValidationError('invalid plan');
    plan = p;
    persist();
    return plan;
  }

  function reset() {
    monitors = [];
    checksByMonitor = new Map();
    dailyStatsByMonitor = new Map();
    allTimeStatsByMonitor = new Map();
    incidents = [];
    plan = 'free';
    nextMonitorId = 1;
    nextIncidentId = 1;
    persist();
  }

  return {
    listMonitors,
    getMonitor,
    getRawMonitor,
    addMonitor,
    updateMonitor,
    removeMonitor,
    recordCheck,
    listIncidents,
    getPlan,
    setPlan,
    reset,
    FREE_PLAN_MONITOR_LIMIT,
    MIN_MONITOR_INTERVAL_MS,
    MAX_MONITOR_INTERVAL_MS,
  };
}

module.exports = {
  createStore,
  ValidationError,
  PlanLimitError,
  FREE_PLAN_MONITOR_LIMIT,
  MIN_MONITOR_INTERVAL_MS,
  MAX_MONITOR_INTERVAL_MS,
};
