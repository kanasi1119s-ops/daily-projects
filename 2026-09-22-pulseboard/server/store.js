'use strict';

// Data store for PulseBoard.
//
// State lives in memory (as before) but, when a `persistPath` is given, is
// also mirrored to a local JSON file on disk (see server/persistence.js) so
// monitors/checks/incidents/plan survive a server restart. With no
// `persistPath` the store behaves exactly as the original in-memory-only
// store (this is what the test suite uses by default, so tests stay fast
// and isolated from the filesystem).

const persistence = require('./persistence');

const FREE_PLAN_MONITOR_LIMIT = 3;
const MAX_CHECKS_PER_MONITOR = 50;
const MAX_INCIDENTS = 100;

class ValidationError extends Error {}
class PlanLimitError extends Error {}

function createStore(options = {}) {
  const persistPath = options.persistPath || null;

  let monitors = [];
  let checksByMonitor = new Map(); // monitorId -> array of check results, oldest first
  let incidents = [];
  let plan = 'free'; // 'free' | 'pro'
  let nextMonitorId = 1;
  let nextIncidentId = 1;

  function persist() {
    if (!persistPath) return;
    persistence.saveSync(persistPath, {
      monitors,
      checksByMonitor: Array.from(checksByMonitor.entries()),
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
    incidents = Array.isArray(data.incidents) ? data.incidents : [];
    plan = data.plan === 'pro' ? 'pro' : 'free';
    nextMonitorId = Number.isInteger(data.nextMonitorId) ? data.nextMonitorId : 1;
    nextIncidentId = Number.isInteger(data.nextIncidentId) ? data.nextIncidentId : 1;
  }

  loadFromDisk();

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
      status: last ? (last.ok ? 'up' : 'down') : 'pending',
      lastCheckedAt: last ? last.timestamp : null,
      lastResponseTimeMs: last ? last.responseTimeMs : null,
      lastStatusCode: last ? last.statusCode : null,
      lastError: last ? last.error : null,
      uptimePct,
      checkCount: checks.length,
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

  function addMonitor({ name, url } = {}) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('name is required');
    }
    if (!url || typeof url !== 'string' || !/^https?:\/\/\S+/i.test(url.trim())) {
      throw new ValidationError('url must be a valid http:// or https:// address');
    }
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
      createdAt: new Date().toISOString(),
    };
    monitors.push(monitor);
    checksByMonitor.set(monitor.id, []);
    persist();
    return decorateMonitor(monitor);
  }

  function removeMonitor(id) {
    const idx = monitors.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    monitors.splice(idx, 1);
    checksByMonitor.delete(id);
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
    removeMonitor,
    recordCheck,
    listIncidents,
    getPlan,
    setPlan,
    reset,
    FREE_PLAN_MONITOR_LIMIT,
  };
}

module.exports = { createStore, ValidationError, PlanLimitError, FREE_PLAN_MONITOR_LIMIT };
