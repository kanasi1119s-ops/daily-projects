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

async function main() {
  const store = createStore({ persistPath: DATA_FILE });
  const { app } = createApp(store);

  if (DATA_FILE) {
    console.log(`Persistence: loading/saving state at ${DATA_FILE}`); // eslint-disable-line no-console
  } else {
    console.log('Persistence disabled (PERSIST=0) — running in-memory only.'); // eslint-disable-line no-console
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
