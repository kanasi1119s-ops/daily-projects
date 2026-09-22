# QA Notes — PulseBoard MVP (2026-09-22)

## Automated tests

21 automated tests, all passing at time of writing (`npm test`, Node's
built-in `node:test` runner + `supertest`):

- `tests/store.test.js` (8 tests) — in-memory store: validation, free-plan
  monitor cap, delete, uptime % calculation, incident logging on
  up↔down transitions (including "first check is already down").
- `tests/checker.test.js` (4 tests) — the HTTP health-check function against
  **local** test servers only (a bundled always-200/always-500 demo server,
  an unreachable loopback port, and a raw TCP server that never responds to
  exercise the timeout path). No real external network calls are made by the
  test suite.
- `tests/api.test.js` (9 tests) — full HTTP API via `supertest`: create/list/
  delete monitors, the 402 free-plan limit and the demo upgrade stub, manual
  check trigger, `/api/status` aggregation (and that it does not leak
  internal numeric monitor ids), and incident recording end to end.

Run with:
```bash
cd 2026-09-22-pulseboard
npm install
npm test
```

## Manual verification performed

- Started the server locally (`PORT=3210 node server/index.js`) and
  confirmed:
  - `GET /api/monitors` returns the two seeded demo monitors with correct
    `up` / `down` status after the first check cycle.
  - `GET /api/status` correctly reports `overall: "degraded"` when one
    seeded monitor is intentionally failing, and logs an incident.
  - `POST /api/monitors` creates a new monitor via the API.
  - `GET /` serves the dashboard HTML (static file serving works).
- Did not perform a full manual browser click-through (no GUI browser
  available in this environment) — the dashboard and status page HTML/JS
  were reviewed by hand for correctness but not interactively clicked. This
  is a gap a human should close before treating the UI as fully verified.

## Known bugs / limitations (carried forward, none are crash-level)

1. **No persistence.** All monitors, check history, incidents and the
   free/pro plan flag live in process memory only. Restarting the server
   resets everything to the two seeded demo monitors on the `free` plan.
   Documented in README.md; fine for an MVP demo, not fine for production.
2. **Single shared admin view, no authentication.** Anyone who can reach the
   server's `/` (not just `/status.html`) can add/delete monitors. Acceptable
   for a local demo; must be fixed (add auth) before any real deployment.
3. **Uptime % is based on only the last 50 checks per monitor** (a rolling
   window), not all-time history. This is a deliberate memory-bound design
   choice for the in-memory MVP and should be clearly labeled if/when this
   becomes a real product ("recent uptime", not "all-time uptime").
4. **No real notifications.** Incidents are recorded and shown in the UI/API
   only. There is no email/Slack/webhook delivery — out of scope for this
   MVP by design.
5. **"Upgrade to Pro" is a pure UI/API stub.** Clicking it calls
   `POST /api/plan/upgrade`, which just flips an in-memory flag with no
   payment step. This is intentional and clearly labeled in the UI copy and
   API response message — see `LEGAL_REVIEW.md`.
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
