// Playwright によるUIスモークテスト(任意実行: node test/ui.test.js)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.click('button[type=submit]');
  if (!(await p.locator('#msgs li.e').count())) throw new Error('required errors not shown');
  if (!(await p.locator('#result').isHidden())) throw new Error('result should be hidden');
  const f = { clientName: 'A社', freelancerName: '山田', orderDate: '2026-11-01', deliveryDate: '2026-11-30',
    scope: 'LP制作', amount: '100000', paymentDate: '2027-03-01' };
  for (const k in f) await p.fill('#' + k, f[k]);
  await p.click('button[type=submit]');
  if (!(await p.locator('#msgs li.w').count())) throw new Error('60-day warning missing');
  if (!(await p.textContent('#out')).includes('¥110,000')) throw new Error('doc missing amount');
  await p.check('#hasInspection'); await p.click('button[type=submit]');
  if (!(await p.locator('#result').isHidden())) throw new Error('inspection date should block');
  await p.fill('#scope', '<img src=x onerror=alert(1)>'); await p.fill('#inspectionDate', '2026-12-05');
  await p.click('button[type=submit]');
  if ((await p.locator('#out img').count())) throw new Error('XSS');
  if (errs.length) throw new Error(errs.join(';'));
  await b.close(); console.log('UI OK');
})().catch(e => { console.error(e); process.exit(1); });
