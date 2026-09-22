'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../server/app');
const { createStore } = require('../server/store');
const { startDemoTargetServer } = require('../server/demo-target');

function freshApp() {
  const { app, store } = createApp(createStore());
  return { app, store };
}

test('GET /api/monitors returns empty list and free plan by default', async () => {
  const { app } = freshApp();
  const res = await request(app).get('/api/monitors');
  assert.equal(res.status, 200);
  assert.equal(res.body.plan, 'free');
  assert.deepEqual(res.body.monitors, []);
});

test('POST /api/monitors validates input (400)', async () => {
  const { app } = freshApp();
  const res = await request(app).post('/api/monitors').send({ name: '' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error);
});

test('POST /api/monitors creates a monitor (201)', async () => {
  const { app } = freshApp();
  const res = await request(app).post('/api/monitors').send({ name: 'My Site', url: 'https://example.com' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'My Site');
  assert.equal(res.body.status, 'pending');
});

test('free plan is capped at 3 monitors -> 402 on the 4th', async () => {
  const { app } = freshApp();
  for (const n of ['A', 'B', 'C']) {
    const r = await request(app).post('/api/monitors').send({ name: n, url: `https://${n}.example.com` });
    assert.equal(r.status, 201);
  }
  const blocked = await request(app).post('/api/monitors').send({ name: 'D', url: 'https://d.example.com' });
  assert.equal(blocked.status, 402);
  assert.match(blocked.body.error, /Free plan/);
});

test('upgrading the plan (demo stub) removes the monitor cap', async () => {
  const { app } = freshApp();
  for (const n of ['A', 'B', 'C']) {
    await request(app).post('/api/monitors').send({ name: n, url: `https://${n}.example.com` });
  }
  const upgrade = await request(app).post('/api/plan/upgrade');
  assert.equal(upgrade.status, 200);
  assert.equal(upgrade.body.plan, 'pro');
  assert.match(upgrade.body.message, /demo/i);

  const fourth = await request(app).post('/api/monitors').send({ name: 'D', url: 'https://d.example.com' });
  assert.equal(fourth.status, 201);
});

test('DELETE /api/monitors/:id removes a monitor, 404 when missing', async () => {
  const { app } = freshApp();
  const created = await request(app).post('/api/monitors').send({ name: 'A', url: 'https://a.example.com' });
  const id = created.body.id;

  const del = await request(app).delete(`/api/monitors/${id}`);
  assert.equal(del.status, 204);

  const list = await request(app).get('/api/monitors');
  assert.deepEqual(list.body.monitors, []);

  const missing = await request(app).delete(`/api/monitors/${id}`);
  assert.equal(missing.status, 404);
});

test('POST /api/monitors/:id/check performs a real check against a local target and updates status', async (t) => {
  const { app } = freshApp();
  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port } = demo.address();

  const created = await request(app).post('/api/monitors').send({ name: 'Demo', url: `http://127.0.0.1:${port}/ok` });
  const id = created.body.id;

  const checked = await request(app).post(`/api/monitors/${id}/check`);
  assert.equal(checked.status, 200);
  assert.equal(checked.body.status, 'up');
  assert.equal(checked.body.lastStatusCode, 200);
});

test('GET /api/status aggregates overall status and hides internal ids', async (t) => {
  const { app } = freshApp();
  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port } = demo.address();

  const ok = await request(app).post('/api/monitors').send({ name: 'Healthy', url: `http://127.0.0.1:${port}/ok` });
  await request(app).post(`/api/monitors/${ok.body.id}/check`);

  const status = await request(app).get('/api/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.overall, 'operational');
  assert.equal(status.body.monitors.length, 1);
  assert.equal(status.body.monitors[0].id, undefined, 'public status should not leak internal monitor ids');

  const failing = await request(app).post('/api/monitors').send({ name: 'Failing', url: `http://127.0.0.1:${port}/fail` });
  await request(app).post(`/api/monitors/${failing.body.id}/check`);

  const status2 = await request(app).get('/api/status');
  assert.equal(status2.body.overall, 'degraded');
  assert.equal(status2.body.incidents.length >= 1, true);
});

test('POST /api/monitors accepts optional webhookUrl and intervalMs', async () => {
  const { app } = freshApp();
  const res = await request(app)
    .post('/api/monitors')
    .send({ name: 'With extras', url: 'https://example.com', webhookUrl: 'https://hooks.example.com/x', intervalMs: 30000 });
  assert.equal(res.status, 201);
  assert.equal(res.body.webhookUrl, 'https://hooks.example.com/x');
  assert.equal(res.body.intervalMs, 30000);
});

test('POST /api/monitors rejects an intervalMs that is too small (validation, 400)', async () => {
  const { app } = freshApp();
  const res = await request(app).post('/api/monitors').send({ name: 'A', url: 'https://a.example.com', intervalMs: 100 });
  assert.equal(res.status, 400);
});

test('PATCH /api/monitors/:id updates fields and returns the updated monitor', async () => {
  const { app } = freshApp();
  const created = await request(app).post('/api/monitors').send({ name: 'A', url: 'https://a.example.com' });
  const id = created.body.id;

  const patched = await request(app)
    .patch(`/api/monitors/${id}`)
    .send({ webhookUrl: 'https://hooks.example.com/y', intervalMs: 10000 });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.webhookUrl, 'https://hooks.example.com/y');
  assert.equal(patched.body.intervalMs, 10000);

  const list = await request(app).get('/api/monitors');
  assert.equal(list.body.monitors[0].webhookUrl, 'https://hooks.example.com/y');
});

test('PATCH /api/monitors/:id 404s for an unknown id, 400s for invalid input', async () => {
  const { app } = freshApp();
  const missing = await request(app).patch('/api/monitors/999').send({ name: 'x' });
  assert.equal(missing.status, 404);

  const created = await request(app).post('/api/monitors').send({ name: 'A', url: 'https://a.example.com' });
  const invalid = await request(app).patch(`/api/monitors/${created.body.id}`).send({ url: 'not-a-url' });
  assert.equal(invalid.status, 400);
});

test('GET /api/status includes uptimeStats for long-term uptime (24h/7d/30d/all-time)', async (t) => {
  const { app } = freshApp();
  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port } = demo.address();

  const created = await request(app).post('/api/monitors').send({ name: 'Healthy', url: `http://127.0.0.1:${port}/ok` });
  await request(app).post(`/api/monitors/${created.body.id}/check`);

  const status = await request(app).get('/api/status');
  assert.equal(status.status, 200);
  assert.ok(status.body.monitors[0].uptimeStats);
  assert.equal(status.body.monitors[0].uptimeStats.allTime.upChecks, 1);
  assert.equal(status.body.monitors[0].uptimeStats.last24h.pct, 100);
});

test('GET /api/incidents starts empty and records a down incident after a failing check', async (t) => {
  const { app } = freshApp();
  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port } = demo.address();

  const empty = await request(app).get('/api/incidents');
  assert.deepEqual(empty.body, []);

  const m = await request(app).post('/api/monitors').send({ name: 'Failing', url: `http://127.0.0.1:${port}/fail` });
  await request(app).post(`/api/monitors/${m.body.id}/check`);

  const incidents = await request(app).get('/api/incidents');
  assert.equal(incidents.body.length, 1);
  assert.equal(incidents.body[0].type, 'down');
});
