# DEPLOYMENT.md — PulseBoard (human-executed runbook)

This file is a runbook for a **human** to follow. The automated pipeline
that built this MVP (and the follow-up pass that added persistence, admin
auth, and Docker verification-by-inspection) did **not** perform any of the
steps below — no domain was purchased, no DNS was touched, no payment
provider was connected, no cloud resource was provisioned, and nothing was
published to a public domain or social account.

## 0. Local build/test confirmation (done by the pipeline)

- `npm install && npm test` was run in this environment: **41/41 tests
  pass** (up from 21 — the follow-up pass added 12 persistence tests and 8
  admin-auth tests).
- The server was manually started (`node server/index.js`) and its API
  endpoints (`/api/monitors`, `/api/status`, `/api/incidents`,
  `POST /api/monitors`) were exercised with `curl` and returned correct
  results.
- **(Follow-up pass) Persistence was verified against a real restart**: a
  monitor created via the API survived a `kill -9` of the server process
  and a fresh process startup against the same data file, with its check
  history intact and without the demo monitors being re-seeded on top of
  it.
- **(Follow-up pass) Admin Basic Auth was verified with curl** against a
  running server with `ADMIN_USER`/`ADMIN_PASSWORD` set: admin routes
  return 401 with no/wrong credentials and 200 with correct ones; the
  public status page and its API stayed reachable with no credentials
  either way.
- `Dockerfile` was written as reference deploy config. The Docker daemon
  was **still not available in this environment** in the follow-up pass
  either (`docker build`/`docker info` fail to reach the socket, and
  starting `dockerd` is blocked by sandbox `ulimit` restrictions), so the
  image was **not** build-tested end-to-end here, same as before. As the
  next best verification: `COPY` paths were confirmed to match the repo
  layout, the Dockerfile's exact `npm ci --omit=dev` was run manually in an
  isolated copy of the repo (installs `express`, correctly omits the
  `supertest` dev dependency), and the Dockerfile's exact `HEALTHCHECK`
  command was run against a server started from that production-only
  install with `NODE_ENV=production` — it returned HTTP 200 / exit 0. No
  bugs were found by inspection; a `VOLUME ["/app/data"]` was added since
  persistence now writes there. **A human should still run
  `docker build -t pulseboard .` and `docker run -p 3000:3000 pulseboard`
  locally before relying on the image** — this remains unverified as an
  actual image build/run.

## 1. Before going live at all

- [x] ~~Decide whether PulseBoard v1 actually needs real persistence~~ —
      **done in the follow-up pass.** State now survives a restart via a
      local JSON file (see README.md "Persistence"). This is still a
      single-file local store, not a production-grade database (no
      concurrent multi-process writers, no replication/backups) — evaluate
      whether that's sufficient before selling to paying customers, or
      whether a real database is still warranted at that point.
- [x] ~~Add authentication~~ — **done in the follow-up pass**: optional
      HTTP Basic Auth via `ADMIN_USER`/`ADMIN_PASSWORD` gates the dashboard
      and admin API. It is **off by default** — a human must explicitly set
      both env vars (to real, non-default values) before exposing the
      dashboard publicly. This is still a single shared admin login, not
      per-user accounts with roles/audit trails.
- [ ] Add basic rate limiting to the public API.

## 2. Domain & hosting (human only — not done by this pipeline)

- [ ] Purchase a domain (e.g. via Google Domains successor, Cloudflare
      Registrar, or a Japanese registrar such as お名前.com) — **a human
      decision and purchase**, not automated here.
- [ ] Choose a host. Reasonable options for this stack:
  - **Render** (`render.yaml`-style web service, or use the `Dockerfile`)
  - **Railway**, **Fly.io**, or **Vercel** (Vercel needs an adapter for a
    long-running Express process with `setInterval`; Render/Fly/Railway are
    a more natural fit for this always-on background-checker design)
- [ ] Connect the purchased domain's DNS (A/AAAA or CNAME record) to the
      host, following that host's instructions. **DNS changes are a human
      step** — never automate pointing a real domain at infrastructure
      without explicit human action and review.
- [ ] Set the `PORT` env var if the host requires a specific port, and
      `CHECK_INTERVAL_MS` if a different check cadence is wanted.
- [ ] Attach a **persistent volume/disk** at `/app/data` on the chosen host
      (e.g. a Render Disk, a Fly.io Volume) — without one, the container's
      filesystem (and therefore `data/pulseboard.json`) is wiped on every
      redeploy/restart, same as the old in-memory-only behavior. The
      `Dockerfile` declares `VOLUME ["/app/data"]` as a hint for this.
- [ ] Set real, non-default `ADMIN_USER`/`ADMIN_PASSWORD` env vars on the
      host before exposing the dashboard — it has **no auth at all** unless
      both are explicitly set.

## 3. Payments (human only — currently fully mocked)

- The app currently has **zero** real payment integration. The "Upgrade to
  Pro" button calls a stub endpoint (`POST /api/plan/upgrade`) that only
  flips an in-memory flag.
- [ ] To sell a real Pro plan, a human must:
  1. Create a Stripe (or comparable) account.
  2. Add real Stripe Checkout / Billing integration in `server/app.js`
     (replace the stub `/api/plan/upgrade` route with a real Checkout
     session + webhook handler).
  3. Store subscription state in a real database (see item 1 above) keyed
     by an authenticated user, not a single global in-memory flag.
  4. Set Stripe secret keys as environment variables on the host — **never
     commit them to the repo.**
- [ ] Decide on final pricing (see `MARKETING.md` for the draft/reference
      pricing only — it is not final).

## 4. Legal/compliance steps before selling (see LEGAL_REVIEW.md)

- [ ] Draft and publish a real Privacy Policy once any user data (e.g.
      signup email) is collected.
- [ ] If selling to Japanese consumers, add a 特定商取引法に基づく表記 page
      with **real** business/operator details. **This pipeline has not
      invented any business registration info — a human must supply
      accurate real details.**
- [ ] Re-review all marketing copy against updated legal requirements at
      that time.

## 5. Deploy config included in this repo (reference only)

- `Dockerfile` — builds a production image (`node server/index.js`,
  port 3000, container healthcheck against `/api/status`, `VOLUME
  ["/app/data"]` for the persisted data file). See "0. Local build/test
  confirmation" above for how it was verified this cycle (still not an
  actual `docker build`, since no daemon is available here).
- `.dockerignore` — excludes `node_modules`, tests, docs, and the local
  `data/` directory from the image.
- `.github/workflows/ci.yml` — runs `npm test` on push/PR touching this
  project folder. This workflow will start running automatically once this
  branch/PR is on GitHub with Actions enabled for the repo — **that itself
  requires no further action**, but it only runs tests, it does not deploy
  anything.

## 6. Explicitly NOT done by this pipeline (hard limits)

- No domain purchased, no DNS changed.
- No real Stripe/payment account connected, no real money moved.
- No container/image pushed to any registry, no cloud resource
  provisioned.
- No deployment triggered on Render/Vercel/Fly/etc.
- No post made to any real social media account.

All of the above remain for a human to execute deliberately, if and when
they decide to take PulseBoard beyond this MVP.
