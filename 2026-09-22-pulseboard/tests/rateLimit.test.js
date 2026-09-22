'use strict';

// Tests for the in-memory per-IP rate limiter (server/rateLimit.js) and its
// wiring into the app on /api/*, including the public /api/status route.

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../server/app');
const { createStore } = require('../server/store');
const { createRateLimiter } = require('../server/rateLimit');

test('createRateLimiter allows requests under the limit and blocks over it, with a 429 + Retry-After', async () => {
  const { app } = createApp(createStore(), { rateLimit: { windowMs: 60000, max: 3 } });

  const r1 = await request(app).get('/api/status');
  const r2 = await request(app).get('/api/status');
  const r3 = await request(app).get('/api/status');
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(r3.status, 200);

  const r4 = await request(app).get('/api/status');
  assert.equal(r4.status, 429);
  assert.ok(r4.headers['retry-after']);
  assert.ok(r4.body.error);
});

test('rate limit headers report remaining requests', async () => {
  const { app } = createApp(createStore(), { rateLimit: { windowMs: 60000, max: 5 } });
  const r1 = await request(app).get('/api/status');
  assert.equal(r1.headers['x-ratelimit-limit'], '5');
  assert.equal(r1.headers['x-ratelimit-remaining'], '4');
});

test('the limit resets after the window elapses', async () => {
  const { app } = createApp(createStore(), { rateLimit: { windowMs: 100, max: 1 } });
  const r1 = await request(app).get('/api/status');
  assert.equal(r1.status, 200);
  const r2 = await request(app).get('/api/status');
  assert.equal(r2.status, 429);

  await new Promise((resolve) => setTimeout(resolve, 150));

  const r3 = await request(app).get('/api/status');
  assert.equal(r3.status, 200);
});

test('rate limiting applies to admin API routes too, not just /api/status', async () => {
  const { app } = createApp(createStore(), { rateLimit: { windowMs: 60000, max: 2 } });
  const r1 = await request(app).get('/api/monitors');
  const r2 = await request(app).get('/api/monitors');
  const r3 = await request(app).get('/api/monitors');
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(r3.status, 429);
});

test('with default (unspecified) limits, normal test-sized bursts of requests are not blocked', async () => {
  const { app } = createApp(createStore());
  for (let i = 0; i < 15; i++) {
    const res = await request(app).get('/api/status');
    assert.equal(res.status, 200, `request ${i} should not be rate-limited under default limits`);
  }
});

test('createRateLimiter middleware instances are independent (no cross-app leakage)', async () => {
  const limiterA = createRateLimiter({ windowMs: 60000, max: 1 });
  const limiterB = createRateLimiter({ windowMs: 60000, max: 1 });
  const express = require('express');
  const appA = express();
  appA.use(limiterA);
  appA.get('/', (req, res) => res.send('ok'));
  const appB = express();
  appB.use(limiterB);
  appB.get('/', (req, res) => res.send('ok'));

  await request(appA).get('/');
  const blockedA = await request(appA).get('/');
  assert.equal(blockedA.status, 429);

  // appB has its own independent limiter state, so its first request is
  // still allowed even though appA is already exhausted.
  const firstB = await request(appB).get('/');
  assert.equal(firstB.status, 200);
});
