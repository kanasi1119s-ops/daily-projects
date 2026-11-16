// 手動E2E: node tests/e2e.cjs (要 npm run build && vite preview を localhost:4173 で起動)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  p.on('dialog', d => d.accept());
  await p.goto('http://localhost:4173/');
  const fail = [];
  const chk = (c, m) => { if (!c) fail.push(m); };
  await p.fill('#limit', '５０，０００');
  for (const [m, a, meth] of [['A町','20000','onestop'],['B村','１５０００','onestop'],['C市','25000','kakutei']]) {
    await p.fill('#f-mun', m); await p.fill('#f-amt', a); await p.selectOption('#f-method', meth); await p.click('button[type=submit]');
  }
  let t = await p.innerText('main');
  chk(t.includes('寄付合計：60,000円'), 'total'); chk(t.includes('上限超過：10,000円'), 'over'); chk(t.includes('無効'), 'mixed warn');
  chk(await p.locator('#list tr').count() === 4, 'rows');
  await p.locator('#list input[type=checkbox]').first().check();
  await p.reload(); t = await p.innerText('main');
  chk(t.includes('寄付合計：60,000円'), 'persist'); chk(await p.locator('#limit').inputValue() === '50000', 'limit persist');
  chk(await p.locator('#list input:checked').count() === 1, 'check persist');
  // XSS
  await p.fill('#f-mun', '<img src=x onerror=window.__x=1>'); await p.fill('#f-amt', '1000'); await p.click('button[type=submit]');
  chk(!(await p.evaluate(() => window.__x)), 'xss');
  // invalid
  await p.fill('#f-mun', 'D'); await p.fill('#f-amt', 'abc'); await p.click('button[type=submit]');
  chk(await p.locator('#list tr').count() === 5, 'invalid amount rejected');
  // delete
  await p.locator('#list button').first().click(); chk(await p.locator('#list tr').count() === 4, 'delete');
  // mobile
  await p.setViewportSize({ width: 375, height: 700 });
  chk(await p.evaluate(() => document.documentElement.scrollWidth <= 376), 'no h-scroll mobile');
  console.log('errors:', errs, 'fail:', fail); await b.browser?.close?.(); await b.close();
  process.exit(fail.length || errs.length ? 1 : 0);
})();
