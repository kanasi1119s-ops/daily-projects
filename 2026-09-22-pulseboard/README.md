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
  status code, and a rolling uptime % (based on the last 50 checks kept
  per monitor)
- Incident log: an entry is recorded whenever a monitor flips from up→down
  or down→up
- **Local file-based persistence** (new): monitors, check history,
  incidents and the free/pro plan flag survive a server restart, saved to a
  JSON file on disk (`data/pulseboard.json` by default) — no external
  database, no cloud service. See "Persistence" below.
- **Optional admin Basic Auth** (new): set `ADMIN_USER` + `ADMIN_PASSWORD`
  to require login for the admin dashboard and every admin API route. Off
  by default. See "Admin authentication" below.
- A public, read-only status page (`/status.html`) that aggregates overall
  system status + per-monitor status + recent incidents — never gated by
  admin auth
- A free-plan cap of 3 monitors, and a **mock** "Upgrade to Pro" button that
  removes the cap client-side — no real payment is processed (see
  `LEGAL_REVIEW.md` and `DEPLOYMENT.md`)
- On first run, two example monitors are seeded against a small local demo
  HTTP server bundled in the app (`server/demo-target.js`), so the dashboard
  is never empty and the whole demo works fully offline

## What's explicitly out of scope for this MVP

- Real user accounts / multi-user auth — the optional Basic Auth is a
  single shared admin login, not per-user accounts
- Real outbound notifications (email/Slack/SMS) — not implemented at all
- Real payment processing — the "Pro" upgrade is a UI-only stub
- Multi-tenant support (one PulseBoard instance = one team's monitors)
- A real production-grade database (the JSON-file store is intentionally
  simple — fine for one small team's data locally, not built for
  concurrent multi-process writers or huge datasets)

See `QA_NOTES.md` for the full list of known limitations.

## Persistence

By default, all state is saved to `data/pulseboard.json` (relative to the
project root) after every write, using an atomic write (temp file +
rename) so a crash mid-write can't corrupt the file. On startup, that file
is loaded back if present; if missing (first run) or unreadable (corrupt),
PulseBoard starts from empty state instead of crashing.

| Variable        | Default                    | Description                                          |
|------------------|-----------------------------|-------------------------------------------------------|
| `DATA_FILE`       | `data/pulseboard.json`      | Path to the persistence file                          |
| `PERSIST`         | (unset)                    | Set to `0` to disable persistence (in-memory only)     |

The `data/` directory is git-ignored and excluded from the Docker build
context — it's local runtime state, not something to commit or bake into
an image. When running via Docker, mount a volume at `/app/data` so data
survives the container being recreated (see `Dockerfile`).

## Admin authentication

The admin dashboard (`/`) and every admin API route (create/delete a
monitor, run a manual check, upgrade/downgrade plan) can optionally be
protected with HTTP Basic Auth:

| Variable          | Default   | Description                                   |
|--------------------|-----------|-------------------------------------------------|
| `ADMIN_USER`        | (unset)   | Admin username; auth is off unless both are set |
| `ADMIN_PASSWORD`    | (unset)   | Admin password                                  |

```bash
ADMIN_USER=admin ADMIN_PASSWORD=change-me npm start
```

The public status page (`/status.html`, `GET /api/status`) is never gated
by this, regardless of whether admin auth is configured — it needs to stay
reachable by anyone it's shared with.

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
| `DATA_FILE`          | `data/pulseboard.json` | Path to the local persistence file |
| `PERSIST`            | (unset) | Set to `0` to disable persistence (in-memory only) |
| `ADMIN_USER`         | (unset) | Admin dashboard username (see "Admin authentication") |
| `ADMIN_PASSWORD`     | (unset) | Admin dashboard password |

For local development with auto-restart on file changes:

```bash
npm run dev
```

## Running the tests

```bash
npm test
```

This runs 41 automated tests (unit tests for the store — including
file-based persistence and a simulated-restart round trip, unit tests for
the HTTP checker against local test servers, integration tests for every
API route via `supertest`, and tests for the optional admin Basic Auth) —
no real external network calls are made in the test suite, so it runs the
same in CI as it does offline.

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
│   ├── app.js           # Express app + routes + optional admin Basic Auth (exported for tests)
│   ├── index.js         # Entry point: seeds demo data, starts scheduler + HTTP server
│   ├── store.js         # Data store (monitors, checks, incidents, plan), optionally file-backed
│   ├── persistence.js    # Atomic JSON-file read/write used by store.js
│   ├── checker.js        # HTTP health-check logic (testable, injectable fetch)
│   └── demo-target.js    # Local always-up/always-down server used to seed demo data
├── public/               # Static frontend (dashboard + public status page)
├── data/                  # Local persisted state (git-ignored, created at runtime)
├── tests/                 # node:test + supertest test suite
├── QA_NOTES.md
├── LEGAL_REVIEW.md
├── DEPLOYMENT.md
├── MARKETING.md
├── Dockerfile
└── .github/workflows/ci.yml
```
