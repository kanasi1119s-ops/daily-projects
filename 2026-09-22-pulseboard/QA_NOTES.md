# QA Notes — PulseBoard MVP (2026-09-22, updated in a follow-up pass)

## Automated tests

41 automated tests, all passing at time of writing (`npm test`, Node's
built-in `node:test` runner + `supertest`):

- `tests/store.test.js` (8 tests) — the data store: validation, free-plan
  monitor cap, delete, uptime % calculation, incident logging on
  up↔down transitions (including "first check is already down").
- `tests/persistence.test.js` (12 tests, new in the follow-up pass) — the
  atomic JSON-file read/write in `server/persistence.js` (round trip,
  missing file, corrupt file, no leftover temp files), and the store wired
  up with `persistPath`: a **simulated restart** (a second, independent
  `createStore()` instance pointed at the same file reads back what a
  first instance wrote — monitors, check history, incidents, plan, and id
  counters), plus deletions and `reset()` also persisting correctly.
- `tests/checker.test.js` (4 tests) — the HTTP health-check function against
  **local** test servers only (a bundled always-200/always-500 demo server,
  an unreachable loopback port, and a raw TCP server that never responds to
  exercise the timeout path). No real external network calls are made by the
  test suite.
- `tests/api.test.js` (9 tests) — full HTTP API via `supertest`: create/list/
  delete monitors, the 402 free-plan limit and the demo upgrade stub, manual
  check trigger, `/api/status` aggregation (and that it does not leak
  internal numeric monitor ids), and incident recording end to end.
- `tests/auth.test.js` (8 tests, new in the follow-up pass) — the optional
  admin Basic Auth: no-auth passthrough when unconfigured, 401 on missing/
  wrong credentials, 200 on correct credentials, dashboard route
  protection, and that the public status page/API stay reachable with no
  credentials even when admin auth is configured.

Run with:
```bash
cd 2026-09-22-pulseboard
npm install
npm test
```

## Follow-up pass (persistence + Docker verification + admin auth)

- **Persistence now works and was verified against a real running server**,
  not just unit tests: started the server, created a monitor via the API,
  `kill -9`'d the process, started a fresh process, and confirmed via
  `GET /api/monitors` that the monitor (and its accumulated check count)
  was still there. See README.md "Persistence" for the on-disk format and
  env vars.
- **Docker build still could not be tested** — same as the previous cycle,
  the Docker daemon is unavailable in this sandbox (`docker build`/`docker
  info` fail to reach the socket, and starting `dockerd` is blocked by
  sandbox `ulimit` restrictions). Verified by hand instead: `COPY` paths
  match the repo layout, and the Dockerfile's exact `npm ci --omit=dev`
  plus its exact `HEALTHCHECK` command were both run manually against an
  isolated production-only install and both succeeded. See DEPLOYMENT.md.
- **Added optional admin Basic Auth**, closing known-limitation #2 below
  when `ADMIN_USER`/`ADMIN_PASSWORD` are set (still no auth at all by
  default, to keep the zero-config local demo working unchanged).

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
- **(Follow-up pass)** Admin auth: started the server with
  `ADMIN_USER`/`ADMIN_PASSWORD` set and confirmed via `curl` that
  `GET /api/monitors` returns 401 with no/wrong credentials and 200 with
  correct ones, while `GET /status.html` and `GET /api/status` both stay
  200 with no credentials at all.
- Did not perform a full manual browser click-through (no GUI browser
  available in this environment) — the dashboard and status page HTML/JS
  were reviewed by hand for correctness but not interactively clicked. This
  is a gap a human should close before treating the UI as fully verified.

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
3. **Uptime % is based on only the last 50 checks per monitor** (a rolling
   window), not all-time history. This was a deliberate memory-bound design
   choice and is unchanged by the new persistence layer (persistence saves
   the same bounded rolling window, not unlimited history) — should be
   clearly labeled if/when this becomes a real product ("recent uptime",
   not "all-time uptime").
4. **No real notifications.** Incidents are recorded and shown in the UI/API
   only. There is no email/Slack/webhook delivery — out of scope for this
   MVP by design.
5. **"Upgrade to Pro" is a pure UI/API stub.** Clicking it calls
   `POST /api/plan/upgrade`, which now persists the flag to disk (not just
   in-memory) but is still just a flag flip with no payment step. This is
   intentional and clearly labeled in the UI copy and API response message
   — see `LEGAL_REVIEW.md`.
6. **Checker timeout is a fixed 5s default**, not configurable per monitor.
   A very slow-but-legitimate endpoint could be misreported as "down". Minor,
   documented, acceptable for MVP.
7. **IPv6-only or non-HTTP(S) targets are not supported** — only
   `http://`/`https://` URLs are accepted by the validation in
   `server/store.js`.
8. **No rate limiting** on the API. A local single-user demo, so low risk
   here, but must be added before any public deployment (noted again in
   `DEPLOYMENT.md`).

None of the above are data-corruption or crash-level bugs; the app was
observed to run continuously through the manual test session without
throwing unhandled exceptions, including while intentionally monitoring a
failing endpoint.
