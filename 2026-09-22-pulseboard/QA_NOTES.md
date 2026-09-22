# QA Notes — PulseBoard MVP (2026-09-22, updated across three follow-up passes)

## Automated tests

77 automated tests, all passing at time of writing (`npm test`, Node's
built-in `node:test` runner + `supertest`):

- `tests/store.test.js` (8 tests) — the data store: validation, free-plan
  monitor cap, delete, uptime % calculation, incident logging on
  up↔down transitions (including "first check is already down").
- `tests/persistence.test.js` (12 tests) — the atomic JSON-file read/write
  in `server/persistence.js` (round trip, missing file, corrupt file, no
  leftover temp files), and the store wired up with `persistPath`: a
  **simulated restart** (a second, independent `createStore()` instance
  pointed at the same file reads back what a first instance wrote —
  monitors, check history, incidents, plan, and id counters), plus
  deletions and `reset()` also persisting correctly.
- `tests/checker.test.js` (4 tests) — the HTTP health-check function against
  **local** test servers only (a bundled always-200/always-500 demo server,
  an unreachable loopback port, and a raw TCP server that never responds to
  exercise the timeout path). No real external network calls are made by the
  test suite.
- `tests/api.test.js` (14 tests) — full HTTP API via `supertest`: create/list/
  delete/edit (`PATCH`) monitors, optional `webhookUrl`/`intervalMs` fields
  and their validation, the 402 free-plan limit and the demo upgrade stub,
  manual check trigger, `/api/status` aggregation including `uptimeStats`
  (and that it does not leak internal numeric monitor ids), and incident
  recording end to end.
- `tests/auth.test.js` (9 tests) — the optional admin Basic Auth: no-auth
  passthrough when unconfigured, 401 on missing/wrong credentials, 200 on
  correct credentials, dashboard route protection, the new `PATCH`
  (edit) route protection, and that the public status page/API stay
  reachable with no credentials even when admin auth is configured.
- `tests/webhook.test.js` (8 tests, new this pass) — outbound webhook
  notifications: `sendWebhook` against a **local HTTP receiver** (never a
  real external URL), including timeout and unreachable-host handling; the
  full up→down / down→up transition flow via `checkMonitorAndNotify` with
  the exact JSON payload shape; no webhook on a monitor's first check or
  when status doesn't change; and that a failing webhook delivery never
  throws or stops `checkAllMonitors` from finishing the rest of the batch.
- `tests/uptimeStats.test.js` (6 tests, new this pass) — the long-term
  uptime aggregate: starts at null/0, `allTime` accumulates beyond the
  50-check rolling window, `last24h`/`last7d`/`last30d` correctly bucket
  checks by UTC calendar day, daily buckets are pruned beyond the 90-day
  cap (bounded size), and the whole aggregate survives a simulated restart
  via `persistPath`.
- `tests/monitorInterval.test.js` (9 tests, new this pass) — per-monitor
  `intervalMs`: validation bounds (5s min, 24h max, integer only) on both
  create and `updateMonitor`, that omitting it falls back to the global
  default, and `checkDueMonitors` actually honoring a shorter/longer
  per-monitor interval against the global default via a scheduler "tick".
- `tests/rateLimit.test.js` (6 tests, new this pass) — the in-memory rate
  limiter: blocks over the configured limit with `429` + `Retry-After`,
  reports `X-RateLimit-*` headers, resets after the window elapses, applies
  to admin routes too (not just `/api/status`), doesn't trip under a normal
  test-sized burst with default limits, and that separate app instances
  never share limiter state (no cross-test/cross-instance leakage).

Run with:
```bash
cd 2026-09-22-pulseboard
npm install
npm test
```

### UI smoke test — real headless browser (new this pass)

```bash
npm run smoke:ui
```

This is intentionally **not** part of `npm test` (see README.md), but was
actually run in this environment against a real headless Chromium
(`/opt/pw-browsers/chromium`, via the `playwright` package): it started the
app in-process against a throwaway temp data file, opened the dashboard,
filled in and submitted the real `#addForm` HTML form, clicked the real
"今すぐ確認" button and waited for a genuine `up` status pill, then opened
`/status.html` and confirmed the same monitor appears there too. Both
pages were screenshotted:

- `screenshots/dashboard.png` — admin dashboard, showing the newly added
  "UI Smoke Test Monitor" with a real 稼働中 (up) status, 100% response
  code 200, and populated 24h/7d/30d/全期間 uptime figures, all produced by
  an actual browser click-through, not by hand-editing test data.
- `screenshots/status.png` — the public status page showing the same
  monitor and an "すべてのサービスが正常に稼働しています" (all operational)
  banner.

This closes the gap noted in the previous pass ("did not perform a full
manual browser click-through, no GUI browser available") — a headless
Chromium **is** available in this environment and was used for real.

## Follow-up pass 1 (persistence + Docker verification + admin auth)

- **Persistence now works and was verified against a real running server**,
  not just unit tests: started the server, created a monitor via the API,
  `kill -9`'d the process, started a fresh process, and confirmed via
  `GET /api/monitors` that the monitor (and its accumulated check count)
  was still there. See README.md "Persistence" for the on-disk format and
  env vars.
- **Docker build still could not be tested** — the Docker daemon was
  unavailable in this sandbox at the time (`docker build`/`docker info`
  failed to reach the socket). Verified by hand instead: `COPY` paths
  match the repo layout, and the Dockerfile's exact `npm ci --omit=dev`
  plus its exact `HEALTHCHECK` command were both run manually against an
  isolated production-only install and both succeeded. (Superseded by
  follow-up pass 3 below, where the daemon did come up.)
- **Added optional admin Basic Auth**, closing known-limitation #2 below
  when `ADMIN_USER`/`ADMIN_PASSWORD` are set (still no auth at all by
  default, to keep the zero-config local demo working unchanged).

## Follow-up pass 2 (webhooks, long-term uptime, per-monitor interval, rate limiting, real browser UI test, Docker retry)

- **Outbound webhook notifications** added (`server/notifier.js`) — see
  README.md "Webhook notifications". Verified by `tests/webhook.test.js`
  against a local HTTP receiver server (never a real external URL).
- **Long-term uptime aggregation** added (`uptimeStats`: last24h/7d/30d/
  all-time from bounded daily rollups) — see README.md "Long-term uptime
  stats". Verified by `tests/uptimeStats.test.js`, including that daily
  buckets are actually pruned past the 90-day cap.
- **Per-monitor check interval override** added (`intervalMs`, 5s-24h
  bounds) plus a new `PATCH /api/monitors/:id` edit route — see README.md
  "Per-monitor check interval". Verified by `tests/monitorInterval.test.js`.
- **Basic in-memory rate limiting** added on all `/api/*` routes — see
  README.md "Rate limiting". Verified by `tests/rateLimit.test.js`,
  closing known-limitation #8 below.
- **Real headless-browser UI smoke test** added and actually run (see "UI
  smoke test" above) — closing the gap this file previously flagged about
  no GUI browser being available.
- **Docker build retried; a real finding this time.** Unlike the previous
  pass, `dockerd` actually started successfully in this sandbox this time
  (`docker info` reported a running server) — so the "daemon unavailable"
  blocker from before is gone. However, `docker build` still could not
  complete: pulling the `node:20-alpine` base image failed with the
  sandbox's outbound network policy returning `403 Forbidden` on the
  connection to Docker Hub's CDN (`production.cloudfront.docker.com`),
  confirmed via the environment's own proxy diagnostics as a policy denial,
  not a transient error — so it was not retried further, per this
  environment's own guidance not to route around an explicit policy
  denial. See DEPLOYMENT.md for the exact command/output and what a human
  needs to do differently (run it somewhere with normal Docker Hub
  egress). This is a more specific, more useful finding than "no daemon,"
  even though the end result (no verified image build) is unchanged.

## Manual verification performed

- Started the server locally (`PORT=3210 node server/index.js`) and
  confirmed:
  - `GET /api/monitors` returns the two seeded demo monitors with correct
    `up` / `down` status after the first check cycle.
  - `GET /api/status` correctly reports `overall: "degraded"` when one
    seeded monitor is intentionally failing, and logs an incident.
  - `POST /api/monitors` creates a new monitor via the API.
  - `GET /` serves the dashboard HTML (static file serving works).
- **(Follow-up pass)** Restart/persistence: started the server with
  persistence on (the default), created a monitor via `POST /api/monitors`,
  `kill -9`'d the process, started a fresh process against the same data
  file, and confirmed `GET /api/monitors` still showed that monitor with
  its accumulated check history intact, and that the two demo monitors
  were not re-seeded on top of it.
- **(Follow-up pass 1)** Admin auth: started the server with
  `ADMIN_USER`/`ADMIN_PASSWORD` set and confirmed via `curl` that
  `GET /api/monitors` returns 401 with no/wrong credentials and 200 with
  correct ones, while `GET /status.html` and `GET /api/status` both stay
  200 with no credentials at all.
- **(Follow-up pass 2)** A full browser click-through was performed via
  `npm run smoke:ui` against a real headless Chromium — see "UI smoke
  test" above for exactly what it exercised. This closes the previous
  gap noted here; the remaining manual-verification items below were
  checked via the automated test suites listed above (webhook delivery
  against a real local receiver, rate limiting against a real running
  app, per-monitor interval scheduling with real timers), which exercise
  the same real code paths a manual `curl` session would.

## Known bugs / limitations (carried forward, none are crash-level)

1. ~~No persistence.~~ **Fixed in the follow-up pass.** State now persists
   to a local JSON file (`data/pulseboard.json` by default) and survives a
   server restart — verified manually (see above) and by
   `tests/persistence.test.js`. Still a simple single-file store, not a
   production-grade database — see README.md "What's explicitly out of
   scope" for that distinction.
2. ~~Single shared admin view, no authentication.~~ **Partially addressed
   in the follow-up pass**: optional HTTP Basic Auth can now be enabled via
   `ADMIN_USER`/`ADMIN_PASSWORD` to gate the dashboard and admin API. It
   remains a single shared login (not per-user accounts) and is **off by
   default** — a human must explicitly set both env vars before treating
   any real deployment as protected.
3. ~~Uptime % is based on only the last 50 checks per monitor, not all-time
   history.~~ **Addressed this pass.** The original rolling-50-checks
   `uptimePct` is unchanged (still useful for "what's happening right
   now"), but every monitor now also has `uptimeStats` (last24h/7d/30d/
   all-time) built from small, bounded daily rollups — see README.md
   "Long-term uptime stats". Note the day-granularity caveat documented
   there (`last24h` is "today's UTC calendar day so far," not a strict
   trailing 24 hours).
4. ~~No real notifications.~~ **Addressed this pass.** Any monitor can have
   an optional webhook URL; a real up↔down transition POSTs a small JSON
   payload to it (works with Slack/Discord incoming webhooks or any URL of
   your own) — see README.md "Webhook notifications". Delivery failures
   are logged and non-fatal. Email/SMS notifications remain unimplemented
   (still out of scope) — only the webhook mechanism was added.
5. **"Upgrade to Pro" is a pure UI/API stub.** Clicking it calls
   `POST /api/plan/upgrade`, which persists the flag to disk (not just
   in-memory) but is still just a flag flip with no payment step. This is
   intentional and clearly labeled in the UI copy and API response message
   — see `LEGAL_REVIEW.md`. Unchanged this pass; real payment integration
   remains a hard-limit-excluded, human-only step.
6. **Checker timeout is a fixed 5s default**, not configurable per monitor.
   A very slow-but-legitimate endpoint could be misreported as "down". Minor,
   documented, acceptable for MVP. (Note: this is distinct from the new
   per-monitor **check interval**, which is now configurable — see
   README.md "Per-monitor check interval" — only the per-request timeout
   is still fixed.)
7. **IPv6-only or non-HTTP(S) targets are not supported** — only
   `http://`/`https://` URLs are accepted by the validation in
   `server/store.js`. This also applies to the new `webhookUrl` field.
8. ~~No rate limiting on the API.~~ **Addressed this pass.** A simple
   in-memory, per-IP, fixed-window limiter now applies to every `/api/*`
   route (default 120 req/IP/60s, configurable via `RATE_LIMIT_MAX` /
   `RATE_LIMIT_WINDOW_MS`) — see README.md "Rate limiting". It's
   deliberately simple: in-memory only (resets on restart), not shared
   across multiple processes/instances behind a load balancer. Good enough
   for a single-instance deployment, not a distributed rate limiter.
9. **Rate limiter state is per-process, not distributed.** If PulseBoard is
   ever run as multiple instances behind a load balancer, each instance
   enforces its own limit independently (so the effective combined limit
   is higher than configured). Not a concern for the single-process
   deployment this MVP targets.
10. **Multi-user accounts remain out of scope, deliberately.** Real
    signup/login/email collection was explicitly deferred this round by
    the person driving the project (not an oversight) — it's a bigger
    architecture + privacy-policy decision (see README.md "What's
    explicitly out of scope" and `LEGAL_REVIEW.md`).
11. **Docker image still not build-verified end-to-end.** The daemon itself
    now starts in this sandbox (an improvement over previous passes), but
    the base-image pull from Docker Hub is blocked by this environment's
    outbound network policy (confirmed `403` policy denial, not a
    transient failure) — see the "Follow-up pass 2" section above and
    DEPLOYMENT.md for the exact command and output. A human with normal
    Docker Hub egress should still run `docker build`/`docker run` once
    before relying on the image.

None of the above are data-corruption or crash-level bugs; the app was
observed to run continuously through the manual test session and the
real-browser UI smoke test without throwing unhandled exceptions,
including while intentionally monitoring a failing endpoint and while a
webhook receiver was unreachable.
