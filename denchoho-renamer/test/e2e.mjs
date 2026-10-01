// 手動実行のE2E: npm start を別プロセスで起動後 `node test/e2e.mjs`(playwright が必要)
import { createRequire } from 'node:module';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire('/node-tools/node_modules/');
const { chromium } = require('playwright');
const url = process.env.URL || 'http://localhost:8080/';
const dir = mkdtempSync(join(tmpdir(), 'e2e-'));
const f1 = join(dir, 'a.pdf'), f2 = join(dir, 'b.PDF');
writeFileSync(f1, 'one'); writeFileSync(f2, 'two');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url);
await page.setInputFiles('#picker', [f1, f2]);
const inputs = page.locator('tbody tr');
if ((await inputs.count()) !== 2) throw new Error('rows != 2');
if (!(await page.locator('#zip').isDisabled())) throw new Error('zip should be disabled when invalid');
for (let i = 0; i < 2; i++) {
  const r = inputs.nth(i).locator('input');
  await r.nth(0).fill('2026/4/1'); await r.nth(1).fill('株式会社テスト'); await r.nth(2).fill('1,000');
}
await inputs.nth(0).locator('select').selectOption('領収書');
const o0 = await page.locator('#out-0').innerText(), o1 = await page.locator('#out-1').innerText();
console.log(o0, '|', o1);
if (o0 !== '20260401_株式会社テスト_1000_領収書.pdf') throw new Error('name0');
if (o1 !== '20260401_株式会社テスト_1000.pdf') throw new Error('name1');
// 同一メタ情報なら -2 が付くこと
await inputs.nth(0).locator('select').selectOption('');
const d0 = await page.locator('#out-0').innerText(), d1 = await page.locator('#out-1').innerText();
console.log('dedupe:', d0, '|', d1);
if (d1 !== '20260401_株式会社テスト_1000-2.pdf') throw new Error('dedupe');
// 入力中にフォーカスが失われないこと
await inputs.nth(0).locator('input').nth(1).focus();
await page.keyboard.type('X');
if (!(await inputs.nth(0).locator('input').nth(1).evaluate((e) => e === document.activeElement))) throw new Error('focus lost');
await inputs.nth(0).locator('input').nth(1).fill('株式会社テスト');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#zip')]);
const zp = join(dir, 'out.zip'); await dl.saveAs(zp);
console.log(execFileSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(z.namelist())', zp]).toString());
if (errors.length) throw new Error('console errors: ' + errors.join('; '));
// スマホ幅で横スクロールが出ないこと
await page.setViewportSize({ width: 375, height: 700 });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log('page horizontal overflow @375px:', overflow);
if (overflow) throw new Error('horizontal overflow');
await browser.close(); console.log('E2E OK');
