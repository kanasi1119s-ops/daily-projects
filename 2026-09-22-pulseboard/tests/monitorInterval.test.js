'use strict';

// Tests for per-monitor check-interval override: validation bounds on
// addMonitor/updateMonitor, and the scheduler's checkDueMonitors() honoring
// a monitor's own intervalMs instead of the global default.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, ValidationError, MIN_MONITOR_INTERVAL_MS, MAX_MONITOR_INTERVAL_MS } = require('../server/store');
const { checkDueMonitors } = require('../server/checker');
const { startDemoTargetServer } = require('../server/demo-target');

test('addMonitor accepts a valid intervalMs override and exposes it', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.example.com', intervalMs: 10000 });
  assert.equal(m.intervalMs, 10000);
});

test('addMonitor rejects an intervalMs below the minimum (too aggressive)', () => {
  const store = createStore();
  assert.throws(() => store.addMonitor({ name: 'A', url: 'https://a.example.com', intervalMs: 100 }), ValidationError);
});

test('addMonitor rejects an intervalMs above the maximum', () => {
  const store = createStore();
  assert.throws(
    () => store.addMonitor({ name: 'A', url: 'https://a.example.com', intervalMs: MAX_MONITOR_INTERVAL_MS + 1 }),
    ValidationError
  );
});

test('addMonitor rejects a non-integer intervalMs', () => {
  const store = createStore();
  assert.throws(() => store.addMonitor({ name: 'A', url: 'https://a.example.com', intervalMs: 5000.5 }), ValidationError);
});

test('omitting intervalMs leaves it null (uses the global default)', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.example.com' });
  assert.equal(m.intervalMs, null);
});

test('updateMonitor can set, change and clear intervalMs and webhookUrl', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.example.com' });

  const withInterval = store.updateMonitor(m.id, { intervalMs: MIN_MONITOR_INTERVAL_MS });
  assert.equal(withInterval.intervalMs, MIN_MONITOR_INTERVAL_MS);

  const withHook = store.updateMonitor(m.id, { webhookUrl: 'https://hooks.example.com/x' });
  assert.equal(withHook.webhookUrl, 'https://hooks.example.com/x');
  assert.equal(withHook.intervalMs, MIN_MONITOR_INTERVAL_MS, 'unrelated fields are untouched by a partial update');

  const cleared = store.updateMonitor(m.id, { intervalMs: null, webhookUrl: null });
  assert.equal(cleared.intervalMs, null);
  assert.equal(cleared.webhookUrl, null);
});

test('updateMonitor validates intervalMs bounds just like addMonitor', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.example.com' });
  assert.throws(() => store.updateMonitor(m.id, { intervalMs: 1 }), ValidationError);
});

test('updateMonitor returns null for an unknown monitor id', () => {
  const store = createStore();
  assert.equal(store.updateMonitor(999, { name: 'x' }), null);
});

test('checkDueMonitors only checks monitors whose own interval (or the default) has elapsed', async (t) => {
  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port } = demo.address();

  const store = createStore();
  const fast = store.addMonitor({ name: 'Fast', url: `http://127.0.0.1:${port}/ok`, intervalMs: 5000 });
  const slow = store.addMonitor({ name: 'Slow', url: `http://127.0.0.1:${port}/ok`, intervalMs: 60000 });

  const t0 = Date.now();
  // Both are "due" on their very first check (no lastCheckedAt yet).
  let results = await checkDueMonitors(store, { defaultIntervalMs: 15000, now: t0 });
  assert.equal(results.length, 2);

  // 10s later: the 5s-interval monitor is due again, the 60s one is not.
  results = await checkDueMonitors(store, { defaultIntervalMs: 15000, now: t0 + 10000 });
  const dueIds = results.map((r) => r.monitorId);
  assert.ok(dueIds.includes(fast.id), 'fast (5s interval) monitor should be due after 10s');
  assert.ok(!dueIds.includes(slow.id), 'slow (60s interval) monitor should not be due after 10s');
});

test('checkDueMonitors falls back to defaultIntervalMs when a monitor has no override', async (t) => {
  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port } = demo.address();

  const store = createStore();
  const m = store.addMonitor({ name: 'Default interval', url: `http://127.0.0.1:${port}/ok` });

  const t0 = Date.now();
  await checkDueMonitors(store, { defaultIntervalMs: 20000, now: t0 });

  const tooSoon = await checkDueMonitors(store, { defaultIntervalMs: 20000, now: t0 + 5000 });
  assert.equal(tooSoon.length, 0, 'should not re-check before the 20s default interval elapses');

  const dueLater = await checkDueMonitors(store, { defaultIntervalMs: 20000, now: t0 + 21000 });
  assert.equal(dueLater.length, 1);
  assert.equal(dueLater[0].monitorId, m.id);
});
