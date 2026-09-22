'use strict';

// A small, dependency-free, in-memory per-IP rate limiter (fixed window).
// Deliberately simple: it's meant to stop obvious hammering/abuse of the
// public API on a single-process deployment, not to be a precise or
// distributed rate limiter. State lives only in this process's memory, so
// it resets on restart and is not shared across multiple instances behind
// a load balancer — documented as a known limitation in README/DEPLOYMENT.

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 120; // requests per window per IP
// Safety valve so the hit-tracking Map itself can't grow unboundedly if a
// huge number of distinct IPs hit the server; stale entries are swept out
// once the map gets this large.
const MAX_TRACKED_IPS = 10000;

function createRateLimiter({ windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  function sweepExpired(now) {
    for (const [ip, entry] of hits) {
      if (now >= entry.resetAt) hits.delete(ip);
    }
  }

  return function rateLimiter(req, res, next) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();

    if (hits.size > MAX_TRACKED_IPS) sweepExpired(now);

    let entry = hits.get(ip);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count += 1;

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: 'too many requests, please slow down', retryAfterSeconds: retryAfterSec });
    }
    next();
  };
}

module.exports = { createRateLimiter, DEFAULT_WINDOW_MS, DEFAULT_MAX };
