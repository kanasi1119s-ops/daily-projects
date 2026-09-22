# PulseBoard

A tiny, self-contained uptime monitor and status page MVP for solo developers
and small teams. Add the URLs you care about, PulseBoard periodically checks
them, and you get a simple admin dashboard plus a shareable public status
page — no external database, no paid third-party API required.

## Concept

- **Target user**: freelance/solo developers and small dev shops who run a
  handful of services (a site, an API, a webhook endpoint) and want a
  lightweight "is it up?" dashboard + status page, without paying for a full
  SaaS like Statuspage.io or UptimeRobot's paid tiers.
- **Monetization hypothesis**: freemium. Free plan = up to 3 monitors.
  Paid "Pro" plan (mocked in this MVP, see below) would unlock more monitors,
  real notifications (email/Slack/webhook) and a custom status-page domain.

## What's implemented (MVP scope)

- Add / delete HTTP(S) monitors (name + URL)
- Background scheduler performs a real HTTP GET against each monitored URL
  on an interval (default 15s, configurable via `CHECK_INTERVAL_MS`)
- Per-monitor status (`up` / `down` / `pending`), last response time, last
  status code, and a rolling uptime % (based on the last 50 checks kept in
  memory)
- Incident log: an entry is recorded whenever a monitor flips from up→down
  or down→up
- A public, read-only status page (`/status.html`) that aggregates overall
  system status + per-monitor status + recent incidents
- A free-plan cap of 3 monitors, and a **mock** "Upgrade to Pro" button that
  removes the cap client-side — no real payment is processed (see
  `LEGAL_REVIEW.md` and `DEPLOYMENT.md`)
- On first run, two example monitors are seeded against a small local demo
  HTTP server bundled in the app (`server/demo-target.js`), so the dashboard
  is never empty and the whole demo works fully offline

## What's explicitly out of scope for this MVP

- Persistent storage — all data (monitors, checks, incidents, plan) lives in
  process memory and is **reset when the server restarts**
- Real user accounts / authentication (single shared admin view)
- Real outbound notifications (email/Slack/SMS) — not implemented at all
- Real payment processing — the "Pro" upgrade is a UI-only stub
- Multi-tenant support (one PulseBoard instance = one team's monitors)

See `QA_NOTES.md` for the full list of known limitations.

## Tech stack

- **Backend**: Node.js (>=18) + Express, in-memory data store, native
  `fetch`/`AbortController` for health checks — zero required external
  services or API keys.
- **Frontend**: plain HTML/CSS/vanilla JS served as static files by Express
  (no build step, no framework, to keep the MVP genuinely small).
- **Tests**: Node's built-in test runner (`node:test`) + `supertest` for
  HTTP-level API tests.

## Setup & run

```bash
cd 2026-09-22-pulseboard
npm install
npm start
# Dashboard:            http://localhost:3000
# Public status page:   http://localhost:3000/status.html
```

Environment variables (all optional):

| Variable            | Default | Description                              |
|---------------------|---------|-------------------------------------------|
| `PORT`               | `3000`  | HTTP port to listen on                    |
| `CHECK_INTERVAL_MS`  | `15000` | How often the background checker runs     |

For local development with auto-restart on file changes:

```bash
npm run dev
```

## Running the tests

```bash
npm test
```

This runs 21 automated tests (unit tests for the in-memory store, unit tests
for the HTTP checker against local test servers, and integration tests for
every API route via `supertest`) — no real external network calls are made
in the test suite, so it runs the same in CI as it does offline.

## API summary

| Method & path                     | Description                                   |
|------------------------------------|------------------------------------------------|
| `GET /api/monitors`                | List monitors + current plan/limit            |
| `POST /api/monitors`               | Create a monitor `{ name, url }`              |
| `DELETE /api/monitors/:id`         | Remove a monitor                              |
| `POST /api/monitors/:id/check`     | Run an immediate check for one monitor        |
| `GET /api/incidents`               | List recent incidents                         |
| `GET /api/status`                  | Public aggregate status (used by status page) |
| `POST /api/plan/upgrade`           | **Demo stub** — flips plan to `pro`, no billing |
| `POST /api/plan/downgrade`         | Flip plan back to `free`                      |

## Project structure

```
2026-09-22-pulseboard/
├── server/
│   ├── app.js           # Express app + routes (exported for tests)
│   ├── index.js         # Entry point: seeds demo data, starts scheduler + HTTP server
│   ├── store.js         # In-memory data store (monitors, checks, incidents, plan)
│   ├── checker.js        # HTTP health-check logic (testable, injectable fetch)
│   └── demo-target.js    # Local always-up/always-down server used to seed demo data
├── public/               # Static frontend (dashboard + public status page)
├── tests/                 # node:test + supertest test suite
├── QA_NOTES.md
├── LEGAL_REVIEW.md
├── DEPLOYMENT.md
├── MARKETING.md
├── Dockerfile
└── .github/workflows/ci.yml
```
