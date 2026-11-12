// 使い方: npm run build && node e2e/run.cjs  (playwright が利用可能な環境)
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
(async () => {
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', '4999', '--strictPort'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 2500));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dn-'));
  fs.writeFileSync(path.join(tmp, 'a.pdf'), '%PDF-1.4 a');
  fs.writeFileSync(path.join(tmp, 'b.pdf'), '%PDF-1.4 b');
  const br = await chromium.launch();
  const page = await br.newPage({ acceptDownloads: true });
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => m.type()==='error' && errs.push(m.text()));
  const reqs = []; page.on('request', r => { if (!r.url().startsWith('http://localhost:4999')) reqs.push(r.url()); });
  await page.goto('http://localhost:4999/');
  await page.setInputFiles('#picker', [path.join(tmp, 'a.pdf'), path.join(tmp, 'b.pdf')]);
  const disabledBefore = await page.locator('#download').isDisabled();
  const rows = page.locator('.row');
  for (let i = 0; i < 2; i++) {
    const inp = rows.nth(i).locator('input');
    await inp.nth(0).fill('令和8年11月12日'); await inp.nth(2).fill('株式会社テスト'); await inp.nth(3).fill('110,000');
  }
  const outs = await page.locator('.out').allTextContents();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
  const zp = path.join(tmp, 'o.zip'); await dl.saveAs(zp);
  const listing = execFileSync('unzip', ['-l', zp]).toString();
  const test = execFileSync('unzip', ['-tq', zp]).toString();
  const csv = execFileSync('unzip', ['-p', zp, '索引簿.csv']).toString();
  console.log(JSON.stringify({ disabledBefore, outs, test: test.trim(), errs, externalRequests: reqs }, null, 1));
  console.log(listing); console.log(csv);
  await br.close(); srv.kill(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
