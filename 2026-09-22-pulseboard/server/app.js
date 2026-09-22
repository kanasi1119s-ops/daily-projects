'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { createStore, ValidationError, PlanLimitError } = require('./store');
const { checkAllMonitors, checkMonitorAndNotify } = require('./checker');
const { createRateLimiter } = require('./rateLimit');

// --- Admin Basic Auth (optional) ---
// Protects the admin dashboard (/ , /index.html) and every admin API route
// (anything that can create/delete monitors, run a check, or change plan).
// The public, read-only status page (/status.html, GET /api/status) is
// deliberately never protected by this — it must stay reachable by anyone
// it's shared with. Auth is only enforced when both `user` and `pass` are
// configured; with neither set, every request passes through unchanged so
// the zero-config local demo keeps working exactly as before.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function parseBasicAuthHeader(header) {
  if (!header || !header.startsWith('Basic ')) return null;
  let decoded;
  try {
    decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  } catch {
    return null;
  }
  const sep = decoded.indexOf(':');
  if (sep === -1) return null;
  return { user: decoded.slice(0, sep), pass: decoded.slice(sep + 1) };
}

function createAdminAuthMiddleware(adminAuth) {
  const user = adminAuth && adminAuth.user;
  const pass = adminAuth && adminAuth.pass;
  if (!user || !pass) {
    return (req, res, next) => next();
  }
  return (req, res, next) => {
    const creds = parseBasicAuthHeader(req.headers.authorization);
    if (creds && safeEqual(creds.user, user) && safeEqual(creds.pass, pass)) {
      return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="PulseBoard admin", charset="UTF-8"');
    return res.status(401).json({ error: 'admin authentication required' });
  };
}

function createApp(store = createStore(), options = {}) {
  const app = express();
  const publicDir = path.join(__dirname, '..', 'public');
  const requireAdminAuth = createAdminAuthMiddleware(options.adminAuth);

  app.use(express.json());

  // Simple in-memory per-IP rate limit on the API (public status endpoints
  // included) — see server/rateLimit.js and README.md/DEPLOYMENT.md for the
  // defaults and env vars. Each app/store instance gets its own limiter
  // state, so tests (which create a fresh app per test) never share counts.
  const rateLimit = createRateLimiter(options.rateLimit);
  app.use('/api/', rateLimit);

  // `index: false` so express.static does NOT auto-serve public/index.html
  // (the admin dashboard) for GET / — that's handled by the explicit,
  // auth-protected route below instead. Every other static file (the
  // public status page, shared CSS, both pages' client JS) is still served
  // here, unauthenticated, exactly as before.
  app.use(express.static(publicDir, { index: false }));

  app.get(['/', '/index.html'], requireAdminAuth, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  function handleError(err, res) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err instanceof PlanLimitError) return res.status(402).json({ error: err.message });
    console.error(err); // eslint-disable-line no-console
    return res.status(500).json({ error: 'internal error' });
  }

  app.get('/api/monitors', requireAdminAuth, (req, res) => {
    res.json({ plan: store.getPlan(), limit: store.FREE_PLAN_MONITOR_LIMIT, monitors: store.listMonitors() });
  });

  app.post('/api/monitors', requireAdminAuth, (req, res) => {
    try {
      const monitor = store.addMonitor(req.body || {});
      res.status(201).json(monitor);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.patch('/api/monitors/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    try {
      const updated = store.updateMonitor(id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'monitor not found' });
      res.json(updated);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.delete('/api/monitors/:id', requireAdminAuth, (req, res) => {
    const id = Number(req.params.id);
    const removed = store.removeMonitor(id);
    if (!removed) return res.status(404).json({ error: 'monitor not found' });
    res.status(204).end();
  });

  app.post('/api/monitors/:id/check', requireAdminAuth, async (req, res) => {
    const id = Number(req.params.id);
    const monitor = store.getMonitor(id);
    if (!monitor) return res.status(404).json({ error: 'monitor not found' });
    const { updated } = await checkMonitorAndNotify(store, monitor, options.checkerOpts);
    res.json(updated);
  });

  app.get('/api/incidents', requireAdminAuth, (req, res) => {
    res.json(store.listIncidents());
  });

  app.get('/api/status', (req, res) => {
    const monitors = store.listMonitors();
    const overall =
      monitors.length === 0
        ? 'unknown'
        : monitors.every((m) => m.status === 'up' || m.status === 'pending')
        ? 'operational'
        : 'degraded';
    res.json({
      overall,
      generatedAt: new Date().toISOString(),
      monitors: monitors.map((m) => ({
        name: m.name,
        status: m.status,
        uptimePct: m.uptimePct,
        uptimeStats: m.uptimeStats,
        lastCheckedAt: m.lastCheckedAt,
      })),
      incidents: store.listIncidents().slice(0, 10),
    });
  });

  // --- Billing: DEMO STUB ONLY. No real payment provider is contacted. ---
  app.post('/api/plan/upgrade', requireAdminAuth, (req, res) => {
    store.setPlan('pro');
    res.json({
      plan: store.getPlan(),
      message: 'Demo upgrade applied. No real payment was processed (see DEPLOYMENT.md to wire up real billing).',
    });
  });

  app.post('/api/plan/downgrade', requireAdminAuth, (req, res) => {
    store.setPlan('free');
    res.json({ plan: store.getPlan() });
  });
  // --- end billing stub ---

  app.post('/api/_internal/run-checks', requireAdminAuth, async (req, res) => {
    // Manual trigger, mainly useful for tests/demo so we don't have to wait
    // for the background scheduler interval.
    const results = await checkAllMonitors(store);
    res.json(results);
  });

  return { app, store };
}

module.exports = { createApp };
