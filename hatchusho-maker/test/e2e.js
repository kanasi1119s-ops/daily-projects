const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  // 空送信 -> エラー表示
  await p.click('button[type=submit]');
  console.log('empty submit msg visible:', await p.isVisible('#msg'), 'out hidden:', !(await p.isVisible('#out')));
  await p.fill('#clientName', 'A社'); await p.fill('#freelancerName', '山田');
  await p.fill('#orderDate', '2026-11-01'); await p.fill('#deliveryDate', '2026-11-15'); await p.fill('#paymentDueDate', '2026-12-15');
  await p.fill('#deliveryPlace', '電子納品'); await p.fill('#workDescription', 'ロゴ\n制作');
  await p.fill('.in', 'ロゴ'); await p.fill('.iq', '1'); await p.fill('.ip', '100000');
  await p.click('button[type=submit]');
  console.log('out visible:', await p.isVisible('#out'));
  console.log('has total:', (await p.textContent('#preview')).includes('¥110,000'));
  // 行追加/削除
  await p.click('#add'); await p.click('.item:nth-child(2) button');
  console.log('rows after add/remove:', await p.locator('.item').count());
  // 最後の1行は消えない
  await p.click('.item button'); console.log('rows after delete last:', await p.locator('.item').count());
  console.log('errors:', errs);
  await b.close();
})();
