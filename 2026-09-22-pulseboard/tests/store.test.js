'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, ValidationError, PlanLimitError } = require('../server/store');

test('addMonitor rejects missing name/url', () => {
  const store = createStore();
  assert.throws(() => store.addMonitor({ url: 'https://a.com' }), ValidationError);
  assert.throws(() => store.addMonitor({ name: 'A' }), ValidationError);
  assert.throws(() => store.addMonitor({ name: 'A', url: 'not-a-url' }), ValidationError);
});

test('addMonitor creates a pending monitor', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'Site', url: 'https://example.com' });
  assert.equal(m.status, 'pending');
  assert.equal(m.uptimePct, null);
  assert.equal(store.listMonitors().length, 1);
});

test('free plan enforces a monitor limit', () => {
  const store = createStore();
  store.addMonitor({ name: 'A', url: 'https://a.com' });
  store.addMonitor({ name: 'B', url: 'https://b.com' });
  store.addMonitor({ name: 'C', url: 'https://c.com' });
  assert.throws(() => store.addMonitor({ name: 'D', url: 'https://d.com' }), PlanLimitError);

  store.setPlan('pro');
  assert.doesNotThrow(() => store.addMonitor({ name: 'D', url: 'https://d.com' }));
  assert.equal(store.listMonitors().length, 4);
});

test('removeMonitor deletes monitor and its checks', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.com' });
  assert.equal(store.removeMonitor(m.id), true);
  assert.equal(store.getMonitor(m.id), null);
  assert.equal(store.removeMonitor(999), false);
});

test('recordCheck updates status and computes uptimePct', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.com' });
  store.recordCheck(m.id, { ok: true, statusCode: 200, responseTimeMs: 12, error: null, timestamp: new Date().toISOString() });
  store.recordCheck(m.id, { ok: false, statusCode: 500, responseTimeMs: 8, error: null, timestamp: new Date().toISOString() });

  const updated = store.getMonitor(m.id);
  assert.equal(updated.status, 'down');
  assert.equal(updated.uptimePct, 50);
  assert.equal(updated.checkCount, 2);
});

test('recordCheck logs an incident on down transition and on recovery', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.com' });

  store.recordCheck(m.id, { ok: true, statusCode: 200, responseTimeMs: 5, error: null, timestamp: new Date().toISOString() });
  assert.equal(store.listIncidents().length, 0, 'no incident on first healthy check');

  store.recordCheck(m.id, { ok: false, statusCode: 500, responseTimeMs: 5, error: null, timestamp: new Date().toISOString() });
  assert.equal(store.listIncidents().length, 1);
  assert.equal(store.listIncidents()[0].type, 'down');

  store.recordCheck(m.id, { ok: true, statusCode: 200, responseTimeMs: 5, error: null, timestamp: new Date().toISOString() });
  assert.equal(store.listIncidents().length, 2);
  assert.equal(store.listIncidents()[0].type, 'recovered');
});

test('recordCheck logs an incident if the very first check is already down', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.com' });
  store.recordCheck(m.id, { ok: false, statusCode: 500, responseTimeMs: 5, error: null, timestamp: new Date().toISOString() });
  assert.equal(store.listIncidents().length, 1);
  assert.equal(store.listIncidents()[0].type, 'down');
});

test('reset clears all state', () => {
  const store = createStore();
  store.addMonitor({ name: 'A', url: 'https://a.com' });
  store.setPlan('pro');
  store.reset();
  assert.equal(store.listMonitors().length, 0);
  assert.equal(store.getPlan(), 'free');
  assert.equal(store.listIncidents().length, 0);
});
