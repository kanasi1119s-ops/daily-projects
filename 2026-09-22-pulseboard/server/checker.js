'use strict';

// Performs the actual HTTP health checks. No paid API, no third-party
// service required: this is a plain outbound HTTP request to a URL the
// user themselves configured (their own site/service to monitor).

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

async function checkAllMonitors(store, opts = {}) {
  const results = [];
  for (const monitor of store.listMonitors()) {
    const result = await checkUrl(monitor.url, opts);
    store.recordCheck(monitor.id, result);
    results.push({ monitorId: monitor.id, ...result });
  }
  return results;
}

module.exports = { checkUrl, checkAllMonitors, DEFAULT_TIMEOUT_MS };
