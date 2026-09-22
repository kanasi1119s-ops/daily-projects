'use strict';

// Outbound webhook notifications for monitor up/down transitions.
//
// This is a plain outbound HTTP POST to a URL the user themselves supplies
// (e.g. a Slack or Discord "incoming webhook" URL, or any endpoint of their
// own) — no third-party API key, no paid notification service required.
//
// Delivery failures must never crash the checker loop: every error is
// caught here and only logged.

const DEFAULT_WEBHOOK_TIMEOUT_MS = 5000;

/**
 * POST a JSON payload to `url`. Always resolves (never rejects) so a caller
 * can safely `await` this without wrapping it in try/catch. On failure it
 * logs a warning and returns { ok: false, error }.
 */
async function sendWebhook(url, payload, { fetchImpl = fetch, timeoutMs = DEFAULT_WEBHOOK_TIMEOUT_MS } = {}) {
  if (!url) return { ok: false, skipped: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (res.body && typeof res.body.cancel === 'function') {
      await res.body.cancel().catch(() => {});
    }
    if (!res.ok) {
      console.warn(`webhook: ${url} responded with HTTP ${res.status} (delivery not retried)`); // eslint-disable-line no-console
    }
    return { ok: res.ok, status: res.status };
  } catch (err) {
    const reason = err && err.name === 'AbortError' ? 'timeout' : (err && err.message) || 'unknown error';
    console.warn(`webhook: delivery to ${url} failed (${reason}) — non-fatal, continuing`); // eslint-disable-line no-console
    return { ok: false, error: reason };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build and send the up/down transition payload for a monitor, if it has a
 * webhookUrl configured. Never throws.
 */
async function notifyTransition(monitor, { newStatus, previousStatus, timestamp }, opts = {}) {
  if (!monitor || !monitor.webhookUrl) return { ok: false, skipped: true };
  const payload = {
    monitor: monitor.name,
    url: monitor.url,
    status: newStatus,
    previousStatus,
    timestamp,
  };
  try {
    return await sendWebhook(monitor.webhookUrl, payload, opts);
  } catch (err) {
    // sendWebhook already catches internally; this is an extra safety net
    // so a bug in this module can never take down the check loop.
    console.error('webhook: unexpected notifier error (non-fatal):', err); // eslint-disable-line no-console
    return { ok: false, error: (err && err.message) || 'unexpected error' };
  }
}

module.exports = { sendWebhook, notifyTransition, DEFAULT_WEBHOOK_TIMEOUT_MS };
