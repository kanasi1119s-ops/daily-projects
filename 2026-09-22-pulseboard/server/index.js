'use strict';

const path = require('path');
const { createApp } = require('./app');
const { createStore } = require('./store');
const { checkAllMonitors, checkDueMonitors } = require('./checker');
const { startDemoTargetServer } = require('./demo-target');
const { DEFAULT_WINDOW_MS: RATE_LIMIT_DEFAULT_WINDOW_MS, DEFAULT_MAX: RATE_LIMIT_DEFAULT_MAX } = require('./rateLimit');

const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS) || 15000;
// Public API rate limiting (in-memory, per-IP, fixed window). See
// README.md/DEPLOYMENT.md "Rate limiting" for details and defaults.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || RATE_LIMIT_DEFAULT_WINDOW_MS;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || RATE_LIMIT_DEFAULT_MAX;
// The scheduler "tick" is how often we check which monitors are due, so
// that a per-monitor intervalMs override shorter than CHECK_INTERVAL_MS is
// actually honored without spawning one timer per monitor. Never faster
// than every 1s, never slower than the global interval itself.
const SCHEDULER_TICK_MS = Math.max(1000, Math.min(CHECK_INTERVAL_MS, 5000));
// Local, file-based persistence — a single JSON file on disk, no external
// database or cloud service. Override with DATA_FILE if needed; set
// PERSIST=0 to run fully in-memory (e.g. for a throwaway demo).
const DATA_FILE =
  process.env.PERSIST === '0' ? null : process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'pulseboard.json');
// Optional admin Basic Auth. Unset by default (zero-config local demo);
// set both ADMIN_USER and ADMIN_PASSWORD to require login for the admin
// dashboard (/) and every admin API route. The public status page
// (/status.html, GET /api/status) is never gated by this.
const ADMIN_USER = process.env.ADMIN_USER || null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

async function main() {
  const store = createStore({ persistPath: DATA_FILE });
  const { app } = createApp(store, {
    adminAuth: { user: ADMIN_USER, pass: ADMIN_PASSWORD },
    rateLimit: { windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX },
  });

  console.log(`Rate limit: ${RATE_LIMIT_MAX} requests / ${RATE_LIMIT_WINDOW_MS}ms per IP on /api/*`); // eslint-disable-line no-console

  if (DATA_FILE) {
    console.log(`Persistence: loading/saving state at ${DATA_FILE}`); // eslint-disable-line no-console
  } else {
    console.log('Persistence disabled (PERSIST=0) — running in-memory only.'); // eslint-disable-line no-console
  }

  if (ADMIN_USER && ADMIN_PASSWORD) {
    console.log('Admin dashboard is protected with Basic Auth (ADMIN_USER/ADMIN_PASSWORD set).'); // eslint-disable-line no-console
  } else {
    console.log('Admin dashboard has NO auth (set ADMIN_USER and ADMIN_PASSWORD to enable Basic Auth).'); // eslint-disable-line no-console
  }

  // A local demo target server backs the two seeded example monitors so the
  // dashboard is never empty on first run and works fully offline. Its port
  // is fixed (not ephemeral) whenever persistence is on, so that a demo
  // monitor's URL saved to disk on one run still resolves after a restart —
  // an ephemeral (random) port would otherwise go stale across restarts and
  // make the seeded monitors falsely report "down" after every restart.
  const seedNeeded = store.listMonitors().length === 0;
  if (seedNeeded || DATA_FILE) {
    const demoTargetPort = DATA_FILE ? Number(process.env.DEMO_TARGET_PORT) || 39199 : 0;
    try {
      const demoTarget = await startDemoTargetServer(demoTargetPort);
      const { port } = demoTarget.address();
      // Only seed new monitors when the store is empty (first run, or
      // persistence disabled) — on a restart with existing persisted data
      // we just need the demo target server running again, not re-seeding.
      if (seedNeeded) {
        store.addMonitor({ name: 'Example service (healthy)', url: `http://127.0.0.1:${port}/ok` });
        store.addMonitor({ name: 'Example service (simulated outage)', url: `http://127.0.0.1:${port}/fail` });
      }
    } catch (err) {
      console.warn('Could not start local demo target / seed example monitors:', err.message); // eslint-disable-line no-console
    }
  }

  // First cycle checks every monitor immediately (so the dashboard is never
  // stuck on "pending" right after startup); after that, a faster scheduler
  // tick only checks whichever monitors are actually due, honoring each
  // monitor's own intervalMs override when it has one (see
  // server/checker.js checkDueMonitors / isDue).
  async function runAllChecksOnce() {
    try {
      await checkAllMonitors(store);
    } catch (err) {
      console.error('Initial check cycle failed:', err); // eslint-disable-line no-console
    }
  }

  async function runDueChecks() {
    try {
      await checkDueMonitors(store, { defaultIntervalMs: CHECK_INTERVAL_MS });
    } catch (err) {
      console.error('Check cycle failed:', err); // eslint-disable-line no-console
    }
  }

  await runAllChecksOnce();
  const timer = setInterval(runDueChecks, SCHEDULER_TICK_MS);
  timer.unref();

  app.listen(PORT, () => {
    console.log(`PulseBoard listening on http://localhost:${PORT}`); // eslint-disable-line no-console
    console.log(`Public status page: http://localhost:${PORT}/status.html`); // eslint-disable-line no-console
  });
}

main();
