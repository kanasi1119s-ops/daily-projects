'use strict';

const { createApp } = require('./app');
const { checkAllMonitors } = require('./checker');
const { startDemoTargetServer } = require('./demo-target');

const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS) || 15000;

async function main() {
  const { app, store } = createApp();

  // Seed a couple of example monitors against a local demo target server so
  // the dashboard is never empty on first run and works fully offline.
  try {
    const demoTarget = await startDemoTargetServer(0);
    const { port } = demoTarget.address();
    store.addMonitor({ name: 'Example service (healthy)', url: `http://127.0.0.1:${port}/ok` });
    store.addMonitor({ name: 'Example service (simulated outage)', url: `http://127.0.0.1:${port}/fail` });
  } catch (err) {
    console.warn('Could not start local demo target / seed example monitors:', err.message); // eslint-disable-line no-console
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
