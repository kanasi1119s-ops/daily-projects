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

- Add / delete / edit HTTP(S) monitors (name + URL, plus optional webhook
  URL and per-monitor check interval — see below)
- Background scheduler performs a real HTTP GET against each monitored URL
  on an interval (default 15s globally via `CHECK_INTERVAL_MS`, optionally
  overridden per monitor — see "Per-monitor check interval" below)
- Per-monitor status (`up` / `down` / `pending`), last response time, last
  status code, a rolling uptime % (based on the last 50 checks kept per
  monitor), and **long-term uptime stats** (last 24h / 7d / 30d / all-time,
  from bounded daily rollups — see "Long-term uptime stats" below)
- Incident log: an entry is recorded whenever a monitor flips from up→down
  or down→up
- **Outbound webhook notifications** (new): give any monitor an optional
  webhook URL and PulseBoard POSTs a small JSON payload to it whenever that
  monitor actually transitions up→down or down→up — see "Webhook
  notifications" below.
- **Basic per-IP rate limiting** (new) on the API, including the public
  `/api/status` — see "Rate limiting" below.
- **Local file-based persistence**: monitors, check history, incidents and
  the free/pro plan flag survive a server restart, saved to a JSON file on
  disk (`data/pulseboard.json` by default) — no external database, no
  cloud service. See "Persistence" below.
- **Optional admin Basic Auth**: set `ADMIN_USER` + `ADMIN_PASSWORD` to
  require login for the admin dashboard and every admin API route. Off by
  default. See "Admin authentication" below.
- A public, read-only status page (`/status.html`) that aggregates overall
  system status + per-monitor status (including long-term uptime) + recent
  incidents — never gated by admin auth
- A free-plan cap of 3 monitors, and a **mock** "Upgrade to Pro" button that
  removes the cap client-side — no real payment is processed (see
  `LEGAL_REVIEW.md` and `DEPLOYMENT.md`)
- On first run, two example monitors are seeded against a small local demo
  HTTP server bundled in the app (`server/demo-target.js`), so the dashboard
  is never empty and the whole demo works fully offline

## What's explicitly out of scope for this MVP

- **Real multi-user accounts (signup/login/email collection)** — deferred
  deliberately, not an oversight. The optional Basic Auth is a single
  shared admin login, not per-user accounts. Real accounts are a bigger
  architecture + privacy-policy decision (email collection triggers real
  privacy-policy obligations — see `LEGAL_REVIEW.md`) intentionally held
  back for a later round when someone chooses to take that step.
- Real payment processing — the "Pro" upgrade is a UI-only stub
- Multi-tenant support (one PulseBoard instance = one team's monitors)
- A real production-grade database (the JSON-file store is intentionally
  simple — fine for one small team's data locally, not built for
  concurrent multi-process writers or huge datasets)
- A distributed/shared rate limiter — the current one is in-memory,
  per-process (see "Rate limiting" below)

See `QA_NOTES.md` for the full list of known limitations.

## Webhook notifications

Any monitor can have an optional `webhookUrl`. Whenever that monitor
actually transitions **up→down** or **down→up** (never on its very first
check — there's no real "previous status" to report yet), PulseBoard sends
a plain `POST` with a JSON body to that URL:

```json
{
  "monitor": "My API",
  "url": "https://api.example.com/health",
  "status": "down",
  "previousStatus": "up",
  "timestamp": "2026-09-22T09:00:00.000Z"
}
```

This needs **no external paid service or API key** — it's just an outbound
HTTP POST to a URL you supply. Paste in a Slack or Discord "incoming
webhook" URL and it works out of the box (both accept a plain JSON body
with reasonable defaults), or point it at any endpoint of your own.
Delivery failures (timeout, connection refused, non-2xx response) are
logged to the server console and are **non-fatal** — they never crash the
checker loop or block other monitors' checks. See `server/notifier.js`.

Set it when creating a monitor (`POST /api/monitors` `{ ..., "webhookUrl":
"https://hooks.slack.com/services/..." }`) or later via `PATCH
/api/monitors/:id`; the dashboard's "詳細設定" (advanced) section on the add
form, and the "編集" (edit) button on each monitor card, do the same
through the UI. Pass an empty string / `null` to remove it.

## Long-term uptime stats

The original rolling uptime % (`uptimePct`) only reflects the last 50
checks — at the default 15s interval, roughly 12 minutes of history. Every
monitor now also has `uptimeStats`, giving up/down counts and a percentage
for:

- `last24h` — today's UTC calendar-day bucket
- `last7d` — trailing 7 UTC calendar days (including today)
- `last30d` — trailing 30 UTC calendar days (including today)
- `allTime` — every check ever recorded for that monitor

These are day-granularity aggregates built from small, bounded daily
up/down tallies (at most 90 days kept per monitor — older days are pruned
automatically) plus a single all-time counter, **not** unbounded per-check
history — so storage stays small no matter how long a monitor has existed
or how often it's checked. Because the buckets are per UTC calendar day
rather than a strict trailing window, `last24h` is closer to "today so
far" than an exact rolling 24 hours; this is called out here rather than
overclaiming precision. Exposed on every monitor (`GET /api/monitors`) and
in `GET /api/status`, and shown on both the dashboard and the public status
page.

## Per-monitor check interval

Each monitor can optionally set its own `intervalMs`, overriding the
global `CHECK_INTERVAL_MS` for that monitor only. Bounds are enforced to
avoid hammering a target: **5,000ms (5s) minimum, 86,400,000ms (24h)
maximum**; a value outside that range is rejected with a 400. Omit it (or
send `null`) to use the global default. Set via `POST /api/monitors` or
`PATCH /api/monitors/:id`, or the dashboard's advanced settings / edit
button. Internally, the scheduler ticks more often than the global
interval (see `SCHEDULER_TICK_MS` in `server/index.js`) and only checks
whichever monitors are actually due, so a short per-monitor override is
honored without spawning one timer per monitor.

## Rate limiting

A simple in-memory, per-IP, fixed-window rate limiter (`server/rateLimit.js`)
is applied to every `/api/*` route, including the public `/api/status` —
important now that this is closer to a real deployable app. Defaults to
**120 requests per IP per 60-second window**; a request over the limit gets
`429` with a `Retry-After` header and `X-RateLimit-Limit` /
`X-RateLimit-Remaining` are set on every response. Configurable via
`RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`. This is deliberately simple:
state is in-memory only (resets on restart) and per-process (not shared
across multiple instances behind a load balancer) — good enough to stop
obvious hammering of a single-instance deployment, not a precise or
distributed limiter. See `DEPLOYMENT.md`.

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
  HTTP-level API tests, plus `playwright` (devDependency) for a real
  headless-Chromium UI smoke test run separately via `npm run smoke:ui`.

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
| `RATE_LIMIT_MAX`     | `120`   | Max requests per IP per window on `/api/*` (see "Rate limiting") |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window size in ms |

For local development with auto-restart on file changes:

```bash
npm run dev
```

## Running the tests

```bash
npm test
```

This runs 77 automated tests (`node --test`): unit tests for the store
(including file-based persistence, a simulated-restart round trip, and the
new long-term uptime rollups / per-monitor interval validation), unit
tests for the HTTP checker against local test servers, integration tests
for every API route via `supertest` (including the new `PATCH
/api/monitors/:id` route and `uptimeStats` in `/api/status`), tests for
the optional admin Basic Auth, tests for outbound webhook delivery against
a local HTTP receiver, and tests for the in-memory rate limiter — no real
external network calls are made in the test suite, so it runs the same in
CI as it does offline.

### UI smoke test (real headless browser)

```bash
npm run smoke:ui
```

A separate script (not part of `npm test`, since it drives a real browser
and is heavier) that starts the app against a throwaway temp data file,
opens the dashboard in real headless Chromium via Playwright, submits the
actual "add monitor" form, clicks "今すぐ確認" to get a real up status,
checks the same monitor shows on the public status page, and saves
screenshots to `screenshots/`. See `QA_NOTES.md` for the latest run's
results. Uses the browser already installed in supported environments at
`PLAYWRIGHT_BROWSERS_PATH` (falls back to Playwright's normal resolution
elsewhere, e.g. after a local `npx playwright install chromium`).

## API summary

| Method & path                     | Description                                   |
|------------------------------------|------------------------------------------------|
| `GET /api/monitors`                | List monitors + current plan/limit (each monitor includes `uptimeStats`, `webhookUrl`, `intervalMs`) |
| `POST /api/monitors`               | Create a monitor `{ name, url, webhookUrl?, intervalMs? }` |
| `PATCH /api/monitors/:id`          | Edit a monitor's `name`/`url`/`webhookUrl`/`intervalMs` |
| `DELETE /api/monitors/:id`         | Remove a monitor                              |
| `POST /api/monitors/:id/check`     | Run an immediate check for one monitor (fires its webhook on a real transition) |
| `GET /api/incidents`               | List recent incidents                         |
| `GET /api/status`                  | Public aggregate status incl. `uptimeStats` (used by status page) |
| `POST /api/plan/upgrade`           | **Demo stub** — flips plan to `pro`, no billing |
| `POST /api/plan/downgrade`         | Flip plan back to `free`                      |

All `/api/*` routes are subject to the rate limiter described above
(`RATE_LIMIT_MAX` requests per IP per `RATE_LIMIT_WINDOW_MS`).

## Project structure

```
2026-09-22-pulseboard/
├── server/
│   ├── app.js           # Express app + routes + optional admin Basic Auth + rate limiting (exported for tests)
│   ├── index.js         # Entry point: seeds demo data, starts scheduler + HTTP server
│   ├── store.js         # Data store (monitors, checks, incidents, plan, uptime rollups), optionally file-backed
│   ├── persistence.js    # Atomic JSON-file read/write used by store.js
│   ├── checker.js        # HTTP health-check logic + scheduler due-check logic (testable, injectable fetch)
│   ├── notifier.js        # Outbound webhook delivery (POST JSON, non-fatal on failure)
│   ├── rateLimit.js       # In-memory per-IP fixed-window rate limiter
│   └── demo-target.js    # Local always-up/always-down server used to seed demo data
├── public/               # Static frontend (dashboard + public status page)
├── scripts/
│   └── ui-smoke.js        # Real headless-browser UI smoke test (Playwright, `npm run smoke:ui`)
├── screenshots/            # Screenshots from the last ui-smoke run (evidence, see QA_NOTES.md)
├── data/                  # Local persisted state (git-ignored, created at runtime)
├── tests/                 # node:test + supertest test suite
├── QA_NOTES.md
├── LEGAL_REVIEW.md
├── DEPLOYMENT.md
├── MARKETING.md
├── Dockerfile
└── .github/workflows/ci.yml
```
