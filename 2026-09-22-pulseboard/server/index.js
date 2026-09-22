'use strict';

const path = require('path');
const { createApp } = require('./app');
const { createStore } = require('./store');
const { checkAllMonitors } = require('./checker');
const { startDemoTargetServer } = require('./demo-target');

const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS) || 15000;
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
  const { app } = createApp(store, { adminAuth: { user: ADMIN_USER, pass: ADMIN_PASSWORD } });

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

  async function runChecks() {
    try {
      await checkAllMonitors(store);
    } catch (err) {
      console.error('Check cycle failed:', err); // eslint-disable-line no-console
    }
  }

  await runChecks();
  const timer = setInterval(runChecks, CHECK_INTERVAL_MS);
  timer.unref();

  app.listen(PORT, () => {
    console.log(`PulseBoard listening on http://localhost:${PORT}`); // eslint-disable-line no-console
    console.log(`Public status page: http://localhost:${PORT}/status.html`); // eslint-disable-line no-console
  });
}

main();
