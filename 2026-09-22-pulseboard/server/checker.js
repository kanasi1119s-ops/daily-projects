'use strict';

// Performs the actual HTTP health checks. No paid API, no third-party
// service required: this is a plain outbound HTTP request to a URL the
// user themselves configured (their own site/service to monitor).

const { notifyTransition } = require('./notifier');

const DEFAULT_TIMEOUT_MS = 5000;

async function checkUrl(url, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'GET', signal: controller.signal, redirect: 'follow' });
    if (res.body && typeof res.body.cancel === 'function') {
      // Drain/cancel the body so we don't hold large responses in memory;
      // we only care about the status code and timing.
      await res.body.cancel().catch(() => {});
    }
    return {
      ok: res.status >= 200 && res.status < 400,
      statusCode: res.status,
      responseTimeMs: Date.now() - start,
      error: null,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: null,
      responseTimeMs: Date.now() - start,
      error: err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || 'unknown error',
      timestamp: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

// Runs one health check for `monitor` (a decorated monitor object, e.g. from
// store.listMonitors()/getMonitor()), records it, and — non-fatally — fires
// an outbound webhook if the monitor just flipped up<->down and has a
// webhookUrl configured. A webhook is deliberately NOT sent for a monitor's
// very first check (there is no real "previous status" to report), only for
// an actual up->down or down->up transition. `webhookOpts` are passed
// through to the notifier (used by tests to point at a local receiver / to
// keep timeouts short).
async function checkMonitorAndNotify(store, monitor, { fetchImpl, timeoutMs, webhookOpts = {} } = {}) {
  const previousStatus = monitor.status;
  const result = await checkUrl(monitor.url, { fetchImpl, timeoutMs });
  const updated = store.recordCheck(monitor.id, result);

  if (updated && previousStatus !== 'pending' && previousStatus !== updated.status) {
    try {
      await notifyTransition(
        monitor,
        { newStatus: updated.status, previousStatus, timestamp: updated.lastCheckedAt },
        webhookOpts
      );
    } catch (err) {
      // notifyTransition already catches internally; this extra guard means
      // a webhook problem can never break the check loop.
      console.error('checker: webhook notification error (non-fatal):', err); // eslint-disable-line no-console
    }
  }

  return { result, updated };
}

// Unconditionally checks every monitor once, regardless of any per-monitor
// interval override. Used by the manual "run all checks now" admin route.
async function checkAllMonitors(store, opts = {}) {
  const results = [];
  for (const monitor of store.listMonitors()) {
    const { result } = await checkMonitorAndNotify(store, monitor, opts);
    results.push({ monitorId: monitor.id, ...result });
  }
  return results;
}

function isDue(monitor, now, defaultIntervalMs) {
  const interval = monitor.intervalMs || defaultIntervalMs;
  if (!monitor.lastCheckedAt) return true;
  return now - Date.parse(monitor.lastCheckedAt) >= interval;
}

// Checks only the monitors that are "due" given the global default interval
// and each monitor's own optional intervalMs override. Meant to be called
// on a scheduler tick that is more frequent than the global interval (e.g.
// every few seconds) so per-monitor overrides shorter than the global
// default are actually honored, without spawning one timer per monitor.
async function checkDueMonitors(store, { defaultIntervalMs = 15000, now = Date.now(), ...opts } = {}) {
  const results = [];
  for (const monitor of store.listMonitors()) {
    if (!isDue(monitor, now, defaultIntervalMs)) continue;
    const { result } = await checkMonitorAndNotify(store, monitor, opts);
    results.push({ monitorId: monitor.id, ...result });
  }
  return results;
}

module.exports = { checkUrl, checkMonitorAndNotify, checkAllMonitors, checkDueMonitors, DEFAULT_TIMEOUT_MS };
