const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ acceptDownloads: true });
  const errs = []; p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:8099/');
  const out = {};
  out.emptyVisible = await p.locator('#empty').isVisible();
  await p.click('#b-sample');
  out.rows = await p.locator('#rows tr').count();
  out.cards = await p.locator('.card b').allTextContents();
  // XSS
  await p.fill('#f-name', '<img src=x onerror=window.__x=1>'); await p.fill('#f-amount', '500'); await p.click('#f-submit');
  out.xss = await p.evaluate(() => window.__x);
  out.rows2 = await p.locator('#rows tr').count();
  // invalid
  await p.fill('#f-name', ''); await p.fill('#f-amount', '10'); await p.click('#f-submit');
  out.err = await p.textContent('#form-error');
  // edit
  await p.fill('#f-name', 'ok'); await p.click('#f-submit');
  await p.locator('#rows tr', { hasText: 'ok' }).getByText('編集').click();
  await p.fill('#f-amount', '777'); await p.click('#f-submit');
  out.edited = await p.locator('#rows tr', { hasText: 'ok' }).textContent();
  out.rows3 = await p.locator('#rows tr').count();
  // reload persistence
  await p.reload(); out.persist = await p.locator('#rows tr').count();
  // downloads
  for (const id of ['b-ics', 'b-csv', 'b-json']) { const [d] = await Promise.all([p.waitForEvent('download'), p.click('#' + id)]); out[id] = d.suggestedFilename(); }
  // import roundtrip
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#b-json')]);
  const path = await d.path(); await p.setInputFiles('#b-import', path);
  await p.waitForTimeout(300); out.afterImport = await p.locator('#rows tr').count(); out.status = await p.textContent('#status');
  // clear
  await p.click('#b-clear'); out.afterClear = await p.locator('#rows tr').count();
  await p.setViewportSize({ width: 375, height: 800 });
  out.hscroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  await p.screenshot({ path: '/tmp/shot.png', fullPage: true });
  console.log(JSON.stringify(out, null, 1), errs);
  await b.close();
})();
