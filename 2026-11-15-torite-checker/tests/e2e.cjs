// Playwright スモークテスト: node tests/e2e.cjs （事前に npm run build && npm run preview -- --port 4173）
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const base = process.env.URL || 'http://localhost:4173/';
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  await page.goto(base);
  // ① 既定値: 発注1億・受注個人 → 該当
  assert.match(await page.locator('#panel-app .result strong').innerText(), /対象となる可能性が高い（資本金基準）/);
  // 受注側資本金を2000万にすると対象外
  await page.locator('#panel-app fieldset').nth(1).locator('input').first().fill('2000');
  assert.match(await page.locator('#panel-app .result strong').innerText(), /対象外/);
  // ② 支払期日
  await page.click('#tab-pay');
  await page.fill('#panel-pay input[type=date] >> nth=0', '2026-11-01');
  await page.fill('#panel-pay input[type=date] >> nth=1', '2026-12-31');
  assert.match(await page.locator('#panel-pay .result').first().innerText(), /期限超過/);
  assert.match(await page.locator('#panel-pay .result').nth(1).innerText(), /60日を超えます/);
  // タブ往復で入力が残る
  await page.click('#tab-app');
  await page.click('#tab-pay');
  assert.equal(await page.inputValue('#panel-pay input[type=date] >> nth=0'), '2026-11-01');
  // ③ チェック
  await page.click('#tab-chk');
  await page.locator('input[name=fee][type=radio]').first().check();
  assert.match(await page.locator('#panel-chk .result').innerText(), /要確認 1件/);
  // 矢印キーでタブ移動
  await page.focus('#tab-chk');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('#tab-app', 'aria-selected'), 'true');
  // 外部へのリクエストなし
  assert.deepEqual(reqs.filter((u) => !u.startsWith(base)), []);
  // 横スクロールなし
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('e2e OK');
})().catch((e) => { console.error(e); process.exit(1); });
