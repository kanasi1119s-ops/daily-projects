'use strict';

// Tests for outbound webhook notifications on up<->down transitions
// (server/notifier.js + the wiring in server/checker.js). A tiny local
// HTTP server plays the role of "the webhook receiver" — exactly like a
// user pasting a Slack/Discord incoming-webhook URL into a monitor, but
// entirely offline. No real external URL is ever contacted in this file.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createStore } = require('../server/store');
const { checkMonitorAndNotify, checkAllMonitors } = require('../server/checker');
const { sendWebhook } = require('../server/notifier');
const { startDemoTargetServer } = require('../server/demo-target');

function startReceiver(handler) {
  return new Promise((resolve) => {
    const received = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          /* leave null */
        }
        received.push(parsed);
        if (handler) handler(req, res, parsed);
        else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, received, port: server.address().port }));
  });
}

test('sendWebhook posts JSON to a local receiver and resolves ok:true on 200', async (t) => {
  const { server, received, port } = await startReceiver();
  t.after(() => server.close());

  const result = await sendWebhook(`http://127.0.0.1:${port}/hook`, { hello: 'world' });
  assert.equal(result.ok, true);
  assert.equal(received.length, 1);
  assert.deepEqual(received[0], { hello: 'world' });
});

test('sendWebhook with no url is a no-op (skipped), never throws', async () => {
  const result = await sendWebhook(null, { a: 1 });
  assert.equal(result.skipped, true);
});

test('sendWebhook against an unreachable local port fails softly (ok:false), does not throw', async () => {
  // Port 1 is reserved/unlikely to be listening.
  await assert.doesNotReject(async () => {
    const result = await sendWebhook('http://127.0.0.1:1/hook', { a: 1 });
    assert.equal(result.ok, false);
  });
});

test('sendWebhook times out gracefully against a non-responding server', async () => {
  const server = http.createServer(() => {
    /* accept and never respond */
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const start = Date.now();
    const result = await sendWebhook(`http://127.0.0.1:${port}/hook`, { a: 1 }, { timeoutMs: 150 });
    assert.equal(result.ok, false);
    assert.ok(Date.now() - start < 2000);
  } finally {
    server.close();
  }
});

test('checkMonitorAndNotify fires the webhook on an up -> down transition, with the right payload shape', async (t) => {
  const { server, received, port: hookPort } = await startReceiver();
  t.after(() => server.close());

  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port: demoPort } = demo.address();

  const store = createStore();
  const created = store.addMonitor({
    name: 'Flaky API',
    url: `http://127.0.0.1:${demoPort}/ok`,
    webhookUrl: `http://127.0.0.1:${hookPort}/hook`,
  });

  // First check (up): no webhook expected — there's no real "previous
  // status" for the very first check.
  await checkMonitorAndNotify(store, created, {});
  assert.equal(received.length, 0, 'no webhook on the first check');

  // Point the same monitor at the failing path and check again -> down.
  store.updateMonitor(created.id, { url: `http://127.0.0.1:${demoPort}/fail` });
  const monitorNowUp = store.getMonitor(created.id);
  await checkMonitorAndNotify(store, monitorNowUp, {});

  assert.equal(received.length, 1, 'exactly one webhook fired on the up->down transition');
  assert.equal(received[0].monitor, 'Flaky API');
  assert.equal(received[0].status, 'down');
  assert.equal(received[0].previousStatus, 'up');
  assert.ok(received[0].timestamp);
  assert.ok(received[0].url.includes('/fail'));

  // And back up again -> recovered webhook.
  store.updateMonitor(created.id, { url: `http://127.0.0.1:${demoPort}/ok` });
  const monitorNowDown = store.getMonitor(created.id);
  await checkMonitorAndNotify(store, monitorNowDown, {});

  assert.equal(received.length, 2);
  assert.equal(received[1].status, 'up');
  assert.equal(received[1].previousStatus, 'down');
});

test('checkMonitorAndNotify does not fire a webhook when status does not change', async (t) => {
  const { server, received, port: hookPort } = await startReceiver();
  t.after(() => server.close());
  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port: demoPort } = demo.address();

  const store = createStore();
  const created = store.addMonitor({
    name: 'Stable',
    url: `http://127.0.0.1:${demoPort}/ok`,
    webhookUrl: `http://127.0.0.1:${hookPort}/hook`,
  });

  await checkMonitorAndNotify(store, created, {});
  const stillUp = store.getMonitor(created.id);
  await checkMonitorAndNotify(store, stillUp, {});

  assert.equal(received.length, 0, 'no webhook when the monitor stays up across checks');
});

test('a monitor with no webhookUrl never triggers an outbound call, and a down monitor is still recorded', async (t) => {
  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port } = demo.address();

  const store = createStore();
  const created = store.addMonitor({ name: 'No webhook', url: `http://127.0.0.1:${port}/ok` });
  await checkMonitorAndNotify(store, created, {});
  store.updateMonitor(created.id, { url: `http://127.0.0.1:${port}/fail` });
  const monitor = store.getMonitor(created.id);
  const { updated } = await checkMonitorAndNotify(store, monitor, {});
  assert.equal(updated.status, 'down');
});

test('a failing webhook delivery does not throw and does not stop checkAllMonitors from finishing', async (t) => {
  const demo = await startDemoTargetServer(0);
  t.after(() => demo.close());
  const { port } = demo.address();

  const store = createStore();
  const flaky = store.addMonitor({
    name: 'Bad webhook target',
    url: `http://127.0.0.1:${port}/ok`,
    webhookUrl: 'http://127.0.0.1:1/nope', // reserved port, will fail fast
  });
  const other = store.addMonitor({ name: 'Other', url: `http://127.0.0.1:${port}/ok` });

  await checkAllMonitors(store); // seed first (up) checks, no transition yet
  store.updateMonitor(flaky.id, { url: `http://127.0.0.1:${port}/fail` });

  await assert.doesNotReject(async () => {
    const results = await checkAllMonitors(store);
    assert.equal(results.length, 2);
  });

  const updatedFlaky = store.getMonitor(flaky.id);
  const updatedOther = store.getMonitor(other.id);
  assert.equal(updatedFlaky.status, 'down');
  assert.equal(updatedOther.status, 'up');
});
