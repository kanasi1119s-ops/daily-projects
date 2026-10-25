const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const srv = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, PORT: '5199' } });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:5199/');
  const rows = await p.$$eval('#result tbody tr', (t) => t.map((r) => r.innerText.replace(/\s+/g, ' ')));
  console.log(rows.join('\n'));
  console.log('summary:', await p.textContent('#summary'));
  await p.fill('#purchase10', '9000000'); await p.uncheck('#twenty');
  console.log('after:', await p.textContent('#summary'));
  await p.fill('#sales10', 'abc').catch(() => {});
  console.log('sens rows:', (await p.$$('#sens tbody tr')).length, 'errors:', JSON.stringify(errs));
  await b.close(); srv.kill();
})();
