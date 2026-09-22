'use strict';

// Tests for file-based persistence: server/persistence.js (the low-level
// atomic JSON read/write) and server/store.js wired up with a persistPath
// (the actual "survives a restart" behavior).
//
// A "restart" is simulated the same way it happens for real: create a
// second, independent store instance pointed at the same file on disk and
// check it picks up what the first instance wrote — nothing is shared in
// memory between the two `createStore()` calls other than the file.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const persistence = require('../server/persistence');
const { createStore } = require('../server/store');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulseboard-test-'));
  return path.join(dir, 'nested', 'pulseboard.json'); // nested to also exercise mkdir -p
}

test('persistence.loadSync returns null when the file does not exist', () => {
  const file = tempFile();
  assert.equal(persistence.loadSync(file), null);
});

test('persistence.loadSync returns null (not a throw) for corrupt JSON', () => {
  const file = tempFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '{ this is not valid json ', 'utf8');
  assert.equal(persistence.loadSync(file), null);
});

test('persistence.saveSync then loadSync round-trips data and creates parent dirs', () => {
  const file = tempFile();
  assert.equal(fs.existsSync(path.dirname(file)), false);
  persistence.saveSync(file, { hello: 'world', n: 42 });
  assert.equal(fs.existsSync(file), true);
  const loaded = persistence.loadSync(file);
  assert.equal(loaded.hello, 'world');
  assert.equal(loaded.n, 42);
  assert.equal(loaded.version, persistence.CURRENT_VERSION);
});

test('saveSync leaves no leftover .tmp files after writing', () => {
  const file = tempFile();
  persistence.saveSync(file, { a: 1 });
  persistence.saveSync(file, { a: 2 });
  const entries = fs.readdirSync(path.dirname(file));
  assert.deepEqual(entries, [path.basename(file)]);
});

test('store without persistPath behaves exactly as a plain in-memory store (no file written)', () => {
  const store = createStore();
  store.addMonitor({ name: 'A', url: 'https://a.example.com' });
  assert.equal(store.listMonitors().length, 1);
  // Nothing to assert about the filesystem here — this test's real job is
  // just making sure createStore() with no options still works unchanged.
});

test('a monitor added via one store instance is readable from a fresh store instance pointed at the same file (restart simulation)', () => {
  const file = tempFile();

  const storeA = createStore({ persistPath: file });
  const created = storeA.addMonitor({ name: 'My Site', url: 'https://example.com' });
  assert.equal(storeA.getPlan(), 'free');

  // Simulate a server restart: a brand new store instance, same file path,
  // nothing shared in memory with storeA.
  const storeB = createStore({ persistPath: file });
  const monitors = storeB.listMonitors();
  assert.equal(monitors.length, 1);
  assert.equal(monitors[0].id, created.id);
  assert.equal(monitors[0].name, 'My Site');
  assert.equal(monitors[0].url, 'https://example.com');
});

test('check history, incidents and plan all survive a simulated restart', () => {
  const file = tempFile();

  const storeA = createStore({ persistPath: file });
  const m = storeA.addMonitor({ name: 'A', url: 'https://a.example.com' });
  storeA.recordCheck(m.id, { ok: true, statusCode: 200, responseTimeMs: 10, error: null, timestamp: new Date().toISOString() });
  storeA.recordCheck(m.id, { ok: false, statusCode: 500, responseTimeMs: 12, error: null, timestamp: new Date().toISOString() });
  storeA.setPlan('pro');

  assert.equal(storeA.listIncidents().length, 1);

  const storeB = createStore({ persistPath: file });
  const reloaded = storeB.getMonitor(m.id);
  assert.equal(reloaded.status, 'down');
  assert.equal(reloaded.checkCount, 2);
  assert.equal(reloaded.uptimePct, 50);
  assert.equal(storeB.getPlan(), 'pro');
  assert.equal(storeB.listIncidents().length, 1);
  assert.equal(storeB.listIncidents()[0].type, 'down');
});

test('removing a monitor persists the deletion across a simulated restart', () => {
  const file = tempFile();

  const storeA = createStore({ persistPath: file });
  const m1 = storeA.addMonitor({ name: 'Keep', url: 'https://keep.example.com' });
  const m2 = storeA.addMonitor({ name: 'Remove', url: 'https://remove.example.com' });
  storeA.removeMonitor(m2.id);

  const storeB = createStore({ persistPath: file });
  const monitors = storeB.listMonitors();
  assert.equal(monitors.length, 1);
  assert.equal(monitors[0].id, m1.id);
});

test('new monitor ids keep incrementing (not reused) after a simulated restart', () => {
  const file = tempFile();

  const storeA = createStore({ persistPath: file });
  const m1 = storeA.addMonitor({ name: 'A', url: 'https://a.example.com' });
  const m2 = storeA.addMonitor({ name: 'B', url: 'https://b.example.com' });
  storeA.removeMonitor(m2.id);

  const storeB = createStore({ persistPath: file });
  const m3 = storeB.addMonitor({ name: 'C', url: 'https://c.example.com' });
  assert.ok(m3.id > m1.id, 'new id should not collide with a previously used id');
});

test('reset() clears the persisted file too, not just in-memory state', () => {
  const file = tempFile();

  const storeA = createStore({ persistPath: file });
  storeA.addMonitor({ name: 'A', url: 'https://a.example.com' });
  storeA.setPlan('pro');
  storeA.reset();

  const storeB = createStore({ persistPath: file });
  assert.equal(storeB.listMonitors().length, 0);
  assert.equal(storeB.getPlan(), 'free');
});

test('store starts from empty state if the persisted file is missing (first run)', () => {
  const file = tempFile();
  const store = createStore({ persistPath: file });
  assert.equal(store.listMonitors().length, 0);
  assert.equal(store.getPlan(), 'free');
});

test('store tolerates a corrupt persisted file by starting from empty state instead of crashing', () => {
  const file = tempFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'not json at all', 'utf8');

  const store = createStore({ persistPath: file });
  assert.equal(store.listMonitors().length, 0);
  assert.doesNotThrow(() => store.addMonitor({ name: 'A', url: 'https://a.example.com' }));
});
