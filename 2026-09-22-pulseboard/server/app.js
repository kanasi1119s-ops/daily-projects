'use strict';

const express = require('express');
const path = require('path');
const { createStore, ValidationError, PlanLimitError } = require('./store');
const { checkAllMonitors, checkUrl } = require('./checker');

function createApp(store = createStore()) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  function handleError(err, res) {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    if (err instanceof PlanLimitError) return res.status(402).json({ error: err.message });
    console.error(err); // eslint-disable-line no-console
    return res.status(500).json({ error: 'internal error' });
  }

  app.get('/api/monitors', (req, res) => {
    res.json({ plan: store.getPlan(), limit: store.FREE_PLAN_MONITOR_LIMIT, monitors: store.listMonitors() });
  });

  app.post('/api/monitors', (req, res) => {
    try {
      const monitor = store.addMonitor(req.body || {});
      res.status(201).json(monitor);
    } catch (err) {
      handleError(err, res);
    }
  });

  app.delete('/api/monitors/:id', (req, res) => {
    const id = Number(req.params.id);
    const removed = store.removeMonitor(id);
    if (!removed) return res.status(404).json({ error: 'monitor not found' });
    res.status(204).end();
  });

  app.post('/api/monitors/:id/check', async (req, res) => {
    const id = Number(req.params.id);
    const monitor = store.getRawMonitor(id);
    if (!monitor) return res.status(404).json({ error: 'monitor not found' });
    const result = await checkUrl(monitor.url);
    const updated = store.recordCheck(id, result);
    res.json(updated);
  });

  app.get('/api/incidents', (req, res) => {
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
        lastCheckedAt: m.lastCheckedAt,
      })),
      incidents: store.listIncidents().slice(0, 10),
    });
  });

  // --- Billing: DEMO STUB ONLY. No real payment provider is contacted. ---
  app.post('/api/plan/upgrade', (req, res) => {
    store.setPlan('pro');
    res.json({
      plan: store.getPlan(),
      message: 'Demo upgrade applied. No real payment was processed (see DEPLOYMENT.md to wire up real billing).',
    });
  });

  app.post('/api/plan/downgrade', (req, res) => {
    store.setPlan('free');
    res.json({ plan: store.getPlan() });
  });
  // --- end billing stub ---

  app.post('/api/_internal/run-checks', async (req, res) => {
    // Manual trigger, mainly useful for tests/demo so we don't have to wait
    // for the background scheduler interval.
    const results = await checkAllMonitors(store);
    res.json(results);
  });

  return { app, store };
}

module.exports = { createApp };
