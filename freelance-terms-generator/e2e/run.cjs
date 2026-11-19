const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
(async () => {
  const srv = spawn('node', ['serve.mjs', '.'], { env: { ...process.env, PORT: '8765' }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const res = []; const t = (n, ok, extra = '') => { res.push([n, ok]); console.log((ok ? 'PASS ' : 'FAIL ') + n + ' ' + extra); };
  await p.goto('http://localhost:8765/');
  // 1 empty submit
  await p.click('button[type=submit]');
  t('empty -> errors', (await p.locator('#msgs .err').count()) >= 8 && (await p.inputValue('#out').catch(() => '')) === '' );
  t('copy disabled on error', await p.isDisabled('#copy'));
  // 2 inspection toggle
  await p.selectOption('[name=inspection]', 'yes'); t('inspection row shown', await p.isVisible('#insRow'));
  await p.selectOption('[name=inspection]', 'no');
  // 3 valid
  const fill = { clientName: '株式会社テスト', freelancerName: '山田太郎', orderDate: '2026-04-01', workContent: 'ロゴ制作<script>alert(1)</script>', deliveryDate: '2026-04-30', deliveryPlace: 'メール', amount: '100000', paymentDate: '2026-05-31', paymentMethod: '銀行振込' };
  for (const [k, v] of Object.entries(fill)) await p.fill(`[name=${k}]`, v);
  t('hint shown', (await p.textContent('#hint')).includes('2026年6月28日'));
  await p.click('button[type=submit]');
  const out = await p.textContent('#out');
  t('valid -> document', out.includes('100,000円') && out.includes('<script>'));
  t('no injected script', (await p.locator('#out script').count()) === 0);
  t('copy enabled', !(await p.isDisabled('#copy')));
  // 4 60-day violation
  await p.fill('[name=paymentDate]', '2026-07-30'); await p.click('button[type=submit]');
  t('60-day violation blocks', (await p.textContent('#msgs')).includes('60日') && (await p.textContent('#out')) === '' && await p.isDisabled('#print'));
  // 5 mobile layout no h-scroll
  await p.setViewportSize({ width: 375, height: 800 });
  t('no horizontal scroll', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  t('no console errors', errs.length === 0, errs.join('|'));
  await b.close(); srv.kill();
  process.exit(res.every(([, o]) => o) ? 0 : 1);
})();
