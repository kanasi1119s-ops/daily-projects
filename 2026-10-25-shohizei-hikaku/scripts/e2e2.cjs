const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const srv = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, PORT: '5198' } });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 360, height: 740 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:5198/');
  console.log('page overflow-x:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  for (const v of ['', '0', '99999999999999', '-100', '1e3']) {
    await p.fill('#sales10', v);
    console.log(JSON.stringify(v), '=>', (await p.textContent('#summary')).slice(0, 60));
  }
  await p.fill('#sales10', '0'); await p.fill('#sales8', '5400000'); await p.fill('#purchase8', '2160000');
  console.log((await p.$$eval('#result tbody tr', (t) => t.map((r) => r.innerText.replace(/\s+/g, ' ')))).join(' | '));
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT, fullPage: true });
  console.log('errors:', JSON.stringify(errs));
  await b.close(); srv.kill();
})();
