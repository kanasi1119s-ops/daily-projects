// E2E: npm run build 後に `node scripts/e2e.cjs`（vite preview を内部起動）
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const { unzipSync } = require('fflate');
const fs = require('fs');
(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const br = await chromium.launch();
  const page = await br.newPage({ acceptDownloads: true });
  const errors = []; const reqs = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost:4175')) reqs.push(r.url()); });
  let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
  try {
    await page.goto('http://localhost:4175/');
    ok(await page.locator('h1').innerText() === '電帳法ファイル名ツール', 'タイトル表示');
    fs.writeFileSync(require('os').tmpdir()+'/inv_20261109.pdf', 'dummy1'); fs.writeFileSync(require('os').tmpdir()+'/b.pdf', 'dummy2'); fs.writeFileSync(require('os').tmpdir()+'/c.pdf', 'dummy3');
    await page.setInputFiles('input[type=file]', [require('os').tmpdir()+'/inv_20261109.pdf', require('os').tmpdir()+'/b.pdf', require('os').tmpdir()+'/c.pdf']);
    ok(await page.locator('tbody tr').count() === 3, '3行追加');
    ok((await page.locator('input[type=date]').first().inputValue()) === '2026-11-09', '日付自動推測');
    ok(await page.locator('button.primary').isDisabled(), '未入力時はDL無効');
    const rows = page.locator('tbody tr');
    for (let i = 0; i < 3; i++) {
      if (i > 0) await rows.nth(i).locator('input[type=date]').fill('2026-11-0' + (i + 1));
      await rows.nth(i).locator('input[aria-label=取引先]').fill(i === 2 ? '' : '株式会社A');
      await rows.nth(i).locator('input[aria-label=金額]').fill('1,000');
    }
    ok((await rows.nth(0).locator('.newname').innerText()) === '20261109_株式会社A_1000.pdf', '新ファイル名プレビュー');
    ok((await rows.nth(2).locator('.err').count()) === 1, '取引先未入力でエラー表示');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('button.primary').click()]);
    const buf = fs.readFileSync(await dl.path());
    const z = unzipSync(new Uint8Array(buf));
    const names = Object.keys(z).sort();
    console.log(names);
    ok(names.includes('20261109_株式会社A_1000.pdf') && names.includes('索引簿.csv') && names.length === 3, 'ZIP内容(不正行は除外)');
    ok(new TextDecoder().decode(z['20261109_株式会社A_1000.pdf']) === 'dummy1', '中身が保持される');
    ok(reqs.length === 0, '外部通信なし ' + JSON.stringify(reqs));
    ok(errors.length === 0, 'コンソールエラーなし ' + JSON.stringify(errors));
    await page.setViewportSize({ width: 375, height: 700 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= 380), 'スマホ幅で横スクロールなし');
  } catch (e) { console.log('ERR', e); fail++; }
  await br.close(); srv.kill(); process.exit(fail ? 1 : 0);
})();
