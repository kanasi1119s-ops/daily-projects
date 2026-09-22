'use strict';

// Tests for long-term uptime aggregation (server/store.js `uptimeStats`):
// bounded daily rollups + an all-time counter, distinct from the existing
// short rolling-50-checks `uptimePct`.

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../server/store');

function checkAt(store, id, ok, isoTimestamp) {
  return store.recordCheck(id, {
    ok,
    statusCode: ok ? 200 : 500,
    responseTimeMs: 5,
    error: ok ? null : 'boom',
    timestamp: isoTimestamp,
  });
}

test('uptimeStats starts at null/0 for a brand-new monitor with no checks', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.example.com' });
  assert.equal(m.uptimeStats.last24h.pct, null);
  assert.equal(m.uptimeStats.allTime.pct, null);
  assert.equal(m.uptimeStats.allTime.upChecks, 0);
});

test('uptimeStats.allTime accumulates beyond the 50-check rolling window', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.example.com' });
  const now = new Date().toISOString();
  for (let i = 0; i < 60; i++) {
    checkAt(store, m.id, true, now);
  }
  const updated = store.getMonitor(m.id);
  // Rolling window is capped at 50...
  assert.equal(updated.checkCount, 50);
  // ...but the all-time aggregate keeps every check ever recorded.
  assert.equal(updated.uptimeStats.allTime.upChecks, 60);
  assert.equal(updated.uptimeStats.allTime.pct, 100);
});

test('uptimeStats.today (last24h bucket) reflects only checks from the current UTC day', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.example.com' });
  const today = new Date().toISOString();
  const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

  checkAt(store, m.id, false, longAgo);
  checkAt(store, m.id, true, today);
  checkAt(store, m.id, true, today);

  const updated = store.getMonitor(m.id);
  assert.equal(updated.uptimeStats.last24h.upChecks, 2);
  assert.equal(updated.uptimeStats.last24h.downChecks, 0);
  assert.equal(updated.uptimeStats.last24h.pct, 100);
  // The 40-day-old failure should still count toward the all-time total...
  assert.equal(updated.uptimeStats.allTime.downChecks, 1);
  // ...but drop out of the last30d window.
  assert.equal(updated.uptimeStats.last30d.downChecks, 0);
});

test('uptimeStats last7d/last30d aggregate across multiple days correctly', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.example.com' });

  const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

  checkAt(store, m.id, true, daysAgo(0));
  checkAt(store, m.id, false, daysAgo(3)); // within 7d and 30d
  checkAt(store, m.id, false, daysAgo(10)); // within 30d only
  checkAt(store, m.id, true, daysAgo(45)); // outside 30d, still all-time

  const updated = store.getMonitor(m.id);
  assert.equal(updated.uptimeStats.last7d.upChecks, 1);
  assert.equal(updated.uptimeStats.last7d.downChecks, 1);
  assert.equal(updated.uptimeStats.last30d.upChecks, 1);
  assert.equal(updated.uptimeStats.last30d.downChecks, 2);
  assert.equal(updated.uptimeStats.allTime.upChecks, 2);
  assert.equal(updated.uptimeStats.allTime.downChecks, 2);
});

test('daily buckets are bounded: more than MAX_DAILY_BUCKETS distinct days are pruned', () => {
  const store = createStore();
  const m = store.addMonitor({ name: 'A', url: 'https://a.example.com' });

  // Record one check per day for 120 distinct days — more than the 90-day
  // cap — and make sure the store never grows an unbounded per-day map.
  for (let i = 0; i < 120; i++) {
    const iso = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString();
    checkAt(store, m.id, true, iso);
  }

  const updated = store.getMonitor(m.id);
  // All-time keeps growing regardless (it's a single O(1) counter)...
  assert.equal(updated.uptimeStats.allTime.upChecks, 120);
  // ...but last30d should only ever reflect ~30 of those checks, proving
  // old daily buckets were pruned rather than kept forever.
  assert.ok(updated.uptimeStats.last30d.upChecks <= 31, 'last30d should not include pruned/ancient days');
});

test('uptimeStats survives a simulated restart via persistPath', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulseboard-uptime-'));
  const file = path.join(dir, 'data.json');

  const storeA = createStore({ persistPath: file });
  const m = storeA.addMonitor({ name: 'A', url: 'https://a.example.com' });
  checkAt(storeA, m.id, true, new Date().toISOString());
  checkAt(storeA, m.id, false, new Date().toISOString());

  const storeB = createStore({ persistPath: file });
  const reloaded = storeB.getMonitor(m.id);
  assert.equal(reloaded.uptimeStats.allTime.upChecks, 1);
  assert.equal(reloaded.uptimeStats.allTime.downChecks, 1);
  assert.equal(reloaded.uptimeStats.last24h.upChecks, 1);
});
