'use strict';

// Tests for the optional admin Basic Auth (server/app.js `adminAuth`
// option). Two things must both hold:
//  1. With no adminAuth configured, everything behaves exactly as before
//     (this is what every other existing test relies on).
//  2. With adminAuth configured, admin routes require correct credentials,
//     while the public status page/API stay reachable with none.

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../server/app');
const { createStore } = require('../server/store');

function basicAuthHeader(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

test('with no adminAuth configured, admin routes require no credentials', async () => {
  const { app } = createApp(createStore());
  const res = await request(app).get('/api/monitors');
  assert.equal(res.status, 200);
});

test('with no adminAuth configured, GET / serves the dashboard with no credentials', async () => {
  const { app } = createApp(createStore());
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /PulseBoard/);
});

test('with adminAuth configured, admin API routes reject requests with no credentials', async () => {
  const { app } = createApp(createStore(), { adminAuth: { user: 'admin', pass: 'secret' } });
  const res = await request(app).get('/api/monitors');
  assert.equal(res.status, 401);
  assert.ok(res.headers['www-authenticate']);
});

test('with adminAuth configured, admin API routes reject wrong credentials', async () => {
  const { app } = createApp(createStore(), { adminAuth: { user: 'admin', pass: 'secret' } });
  const res = await request(app).get('/api/monitors').set('Authorization', basicAuthHeader('admin', 'wrong'));
  assert.equal(res.status, 401);
});

test('with adminAuth configured, admin API routes accept correct credentials', async () => {
  const { app } = createApp(createStore(), { adminAuth: { user: 'admin', pass: 'secret' } });
  const res = await request(app).get('/api/monitors').set('Authorization', basicAuthHeader('admin', 'secret'));
  assert.equal(res.status, 200);
  assert.equal(res.body.plan, 'free');
});

test('with adminAuth configured, POST /api/monitors (create) is protected', async () => {
  const { app } = createApp(createStore(), { adminAuth: { user: 'admin', pass: 'secret' } });
  const unauth = await request(app).post('/api/monitors').send({ name: 'A', url: 'https://a.example.com' });
  assert.equal(unauth.status, 401);

  const authed = await request(app)
    .post('/api/monitors')
    .set('Authorization', basicAuthHeader('admin', 'secret'))
    .send({ name: 'A', url: 'https://a.example.com' });
  assert.equal(authed.status, 201);
});

test('with adminAuth configured, GET / (dashboard) requires credentials', async () => {
  const { app } = createApp(createStore(), { adminAuth: { user: 'admin', pass: 'secret' } });
  const unauth = await request(app).get('/');
  assert.equal(unauth.status, 401);

  const authed = await request(app).get('/').set('Authorization', basicAuthHeader('admin', 'secret'));
  assert.equal(authed.status, 200);
  assert.match(authed.text, /PulseBoard/);
});

test('with adminAuth configured, the public status page and API stay reachable with no credentials', async () => {
  const { app } = createApp(createStore(), { adminAuth: { user: 'admin', pass: 'secret' } });

  const statusApi = await request(app).get('/api/status');
  assert.equal(statusApi.status, 200);
  assert.equal(statusApi.body.overall, 'unknown');

  const statusPage = await request(app).get('/status.html');
  assert.equal(statusPage.status, 200);
});
