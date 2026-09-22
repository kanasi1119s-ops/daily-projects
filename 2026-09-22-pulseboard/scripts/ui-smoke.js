'use strict';

// Real headless-browser UI smoke test for PulseBoard.
//
// This is deliberately NOT part of `npm test` (node:test) — it drives a
// real Chromium instance via Playwright, which is heavier and slightly
// slower than the unit/integration suite, and this environment's
// pre-installed browser location is specific to this sandbox. Run it
// explicitly with `npm run smoke:ui`.
//
// What it does, against a real running server (in-process, pointed at a
// throwaway temp data file — never the project's own data/ directory):
//   1. Opens the admin dashboard in headless Chromium.
//   2. Fills in and submits the actual "add monitor" HTML form (not an API
//      call) and waits for the new monitor card to render.
//   3. Screenshots the dashboard.
//   4. Opens the public status page and waits for the same monitor to
//      appear there too.
//   5. Screenshots the status page.
//
// Screenshots are written to 2026-09-22-pulseboard/screenshots/ and are
// referenced from QA_NOTES.md as evidence this was actually exercised in a
// real browser, not just reviewed by hand.

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { chromium } = require('playwright');
const { createApp } = require('../server/app');
const { createStore } = require('../server/store');
const { startDemoTargetServer } = require('../server/demo-target');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');
const CHROMIUM_EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM_PATH || path.join(process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers', 'chromium');

async function launchChromium() {
  // Prefer the pre-installed browser this sandbox ships at a fixed path
  // (see PLAYWRIGHT_BROWSERS_PATH / PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD in the
  // environment) — fall back to Playwright's own default resolution if that
  // exact path isn't present, so this script still works in an environment
  // with a normal `playwright install`.
  if (fs.existsSync(CHROMIUM_EXECUTABLE)) {
    return chromium.launch({ headless: true, executablePath: CHROMIUM_EXECUTABLE });
  }
  return chromium.launch({ headless: true });
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const tmpDataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pulseboard-ui-smoke-')), 'data.json');

  console.log(`[ui-smoke] temp data file: ${tmpDataFile}`);

  const store = createStore({ persistPath: tmpDataFile });
  const { app } = createApp(store, {});
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  console.log(`[ui-smoke] server listening on http://127.0.0.1:${port}`);

  const demoTarget = await startDemoTargetServer(0);
  const demoPort = demoTarget.address().port;

  let browser;
  const failures = [];

  try {
    browser = await launchChromium();
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

    // --- 1. Dashboard: fill in and submit the real HTML form ---
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });

    const monitorName = 'UI Smoke Test Monitor';
    const monitorUrl = `http://127.0.0.1:${demoPort}/ok`;

    await page.fill('#nameInput', monitorName);
    await page.fill('#urlInput', monitorUrl);
    await page.click('#addForm button[type="submit"]');

    await page.waitForSelector(`.monitor-card:has-text("${monitorName}")`, { timeout: 10000 });
    const cardText = await page.locator('.monitor-card', { hasText: monitorName }).innerText();
    if (!cardText.includes(monitorName)) {
      failures.push('dashboard: monitor card did not render the expected name after adding it via the UI form');
    } else {
      console.log('[ui-smoke] OK: monitor added via the real dashboard form and rendered in the grid');
    }

    // Click the real "今すぐ確認" (check now) button so the card shows an
    // actual "up" result from a real HTTP check, not just "pending".
    const card = page.locator('.monitor-card', { hasText: monitorName });
    await card.locator('button[data-action="check"]').click();
    await page.waitForSelector(`.monitor-card:has-text("${monitorName}") .status-pill.up`, { timeout: 10000 });
    console.log('[ui-smoke] OK: manual "check now" button produced a real up status via the UI');

    const dashboardShot = path.join(SCREENSHOT_DIR, 'dashboard.png');
    await page.screenshot({ path: dashboardShot, fullPage: true });
    console.log(`[ui-smoke] screenshot: ${dashboardShot}`);

    // --- 2. Public status page ---
    await page.goto(`http://127.0.0.1:${port}/status.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`.monitor-card:has-text("${monitorName}")`, { timeout: 10000 });
    console.log('[ui-smoke] OK: same monitor visible on the public status page');

    const statusShot = path.join(SCREENSHOT_DIR, 'status.png');
    await page.screenshot({ path: statusShot, fullPage: true });
    console.log(`[ui-smoke] screenshot: ${statusShot}`);
  } catch (err) {
    failures.push(`unexpected error: ${err && err.stack ? err.stack : err}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => demoTarget.close(resolve));
  }

  if (failures.length) {
    console.error('[ui-smoke] FAILED:');
    for (const f of failures) console.error(' - ' + f);
    process.exitCode = 1;
  } else {
    console.log('[ui-smoke] All checks passed.');
  }
}

main().catch((err) => {
  console.error('[ui-smoke] fatal error:', err);
  process.exitCode = 1;
});
