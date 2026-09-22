# DEPLOYMENT.md — PulseBoard (human-executed runbook)

This file is a runbook for a **human** to follow. The automated pipeline
that built this MVP did **not** perform any of the steps below — no domain
was purchased, no DNS was touched, no payment provider was connected, no
cloud resource was provisioned, and nothing was published to a public
domain or social account.

## 0. Local build/test confirmation (done by the pipeline)

- `npm install && npm test` was run in this environment: **21/21 tests
  pass**.
- The server was manually started (`node server/index.js`) and its API
  endpoints (`/api/monitors`, `/api/status`, `/api/incidents`,
  `POST /api/monitors`) were exercised with `curl` and returned correct
  results.
- `Dockerfile` was written as reference deploy config, but the Docker
  daemon was **not available in this environment**, so the image was **not**
  build-tested here. A human should run `docker build -t pulseboard .` and
  `docker run -p 3000:3000 pulseboard` locally before relying on it.

## 1. Before going live at all

- [ ] Decide whether PulseBoard v1 actually needs real persistence (a real
      database) before selling it — the current in-memory store resets on
      every restart/deploy, which is not acceptable for a paying customer's
      monitor data. This is the single biggest gap between this MVP and a
      sellable product.
- [ ] Add authentication (even a simple single-admin password) before
      exposing the dashboard (not just the status page) publicly — currently
      anyone who can reach the server can add/delete monitors.
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
  port 3000, container healthcheck against `/api/status`).
- `.dockerignore` — excludes `node_modules`, tests, docs from the image.
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
