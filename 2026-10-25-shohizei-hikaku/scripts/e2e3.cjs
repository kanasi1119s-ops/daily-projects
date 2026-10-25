const { chromium } = require('playwright');
const { spawn } = require('child_process');
(async () => {
  const srv = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, PORT: '5197' } });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 360, height: 740 } });
  await p.goto('http://localhost:5197/');
  for (const id of ['result', 'sens']) console.log(id, 'clipped:', await p.$eval('#' + id, (t) => t.parentElement.scrollWidth > t.parentElement.clientWidth));
  await b.close(); srv.kill();
})();
