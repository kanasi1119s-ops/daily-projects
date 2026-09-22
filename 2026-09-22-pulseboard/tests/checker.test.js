'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { checkUrl } = require('../server/checker');
const { startDemoTargetServer } = require('../server/demo-target');

// Starts a raw TCP server that accepts the connection but never writes a
// response, so any HTTP client against it will hang until it gives up.
function startHangingServer() {
  return new Promise((resolve) => {
    const server = net.createServer(() => {
      /* accept and do nothing */
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('checkUrl marks a 200 response as ok', async (t) => {
  const server = await startDemoTargetServer(0);
  t.after(() => server.close());
  const { port } = server.address();

  const result = await checkUrl(`http://127.0.0.1:${port}/ok`);
  assert.equal(result.ok, true);
  assert.equal(result.statusCode, 200);
  assert.equal(result.error, null);
  assert.equal(typeof result.responseTimeMs, 'number');
});

test('checkUrl marks a 500 response as down (ok=false) without throwing', async (t) => {
  const server = await startDemoTargetServer(0);
  t.after(() => server.close());
  const { port } = server.address();

  const result = await checkUrl(`http://127.0.0.1:${port}/fail`);
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 500);
});

test('checkUrl reports an unreachable host as down with an error, not a crash', async () => {
  // Port 1 is reserved/unlikely to be listening; connection should be refused fast.
  const result = await checkUrl('http://127.0.0.1:1/');
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, null);
  assert.ok(result.error, 'expected an error message to be recorded');
});

test('checkUrl times out gracefully on a non-responding connection', async (t) => {
  const server = await startHangingServer();
  t.after(() => server.close());
  const { port } = server.address();

  const start = Date.now();
  const result = await checkUrl(`http://127.0.0.1:${port}/`, { timeoutMs: 200 });
  const elapsed = Date.now() - start;

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, null);
  assert.equal(result.error, 'timeout');
  assert.ok(elapsed < 2000, `expected the check to abort quickly, took ${elapsed}ms`);
});
