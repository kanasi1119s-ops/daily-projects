const assert = require('assert');
const L = require('../src/lib.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const base = () => ({ clientName: 'A社', freelancerName: '山田太郎', orderDate: '2026-11-01', workDescription: 'ロゴ制作',
  deliveryDate: '2026-11-15', deliveryPlace: '電子納品', paymentDueDate: '2026-12-15', paymentMethod: 'cash',
  items: [{ name: 'ロゴ', qty: '1', unitPrice: '100,000' }], taxRate: 0.1 });

t('valid sample has no errors', () => assert.deepStrictEqual(L.validate(base()).errors, []));
t('totals incl. tax floor', () => { const x = L.calcTotals([{ name: 'a', qty: 3, unitPrice: 333 }]); assert.strictEqual(x.subtotal, 999); assert.strictEqual(x.tax, 99); assert.strictEqual(x.total, 1098); });
t('fullwidth amount', () => assert.strictEqual(L.parseAmount('１，２３４円'), 1234));
t('invalid amount NaN', () => { assert.ok(isNaN(L.parseAmount('-5'))); assert.ok(isNaN(L.parseAmount('1.5'))); assert.ok(isNaN(L.parseAmount(''))); });
t('invalid date (2026-02-30)', () => assert.strictEqual(L.isValidDate('2026-02-30'), false));
t('missing required', () => assert.ok(L.validate({ items: [] }).errors.length >= 7));
t('payment >60 days warns', () => { const d = base(); d.paymentDueDate = '2027-02-01'; assert.ok(L.validate(d).warnings.some(w => w.includes('60日'))); });
t('exactly 60 days no warning', () => { const d = base(); d.paymentDueDate = '2026-01-14'.replace('2026-01-14', '2027-01-14'); assert.strictEqual(L.daysBetween('2026-11-15', '2027-01-14'), 60); assert.deepStrictEqual(L.validate(d).warnings, []); });
t('payment before delivery errors', () => { const d = base(); d.paymentDueDate = '2026-11-10'; assert.ok(L.validate(d).errors.length); });
t('inspection required date', () => { const d = base(); d.hasInspection = true; assert.ok(L.validate(d).errors.length); });
t('non-cash needs note', () => { const d = base(); d.paymentMethod = 'other'; assert.ok(L.validate(d).errors.length); });
t('zero total errors', () => { const d = base(); d.items = [{ name: 'x', qty: '0', unitPrice: '5' }]; assert.ok(L.validate(d).errors.length); });
t('item without name errors', () => { const d = base(); d.items = [{ name: '', qty: '1', unitPrice: '5' }]; assert.ok(L.validate(d).errors.length); });
t('xss escaped', () => { const d = base(); d.clientName = '<script>alert(1)</script>'; const h = L.renderDocument(d); assert.ok(!h.includes('<script>')); });
t('invoice no format warns', () => { const d = base(); d.clientInvoiceNo = '123'; assert.ok(L.validate(d).warnings.length); });
t('decimal qty', () => { assert.strictEqual(L.calcTotals([{ name: 'h', qty: '1.5', unitPrice: '3000' }]).subtotal, 4500); });
t('bad qty row errors', () => { const d = base(); d.items = [{ name: 'x', qty: 'abc', unitPrice: '5' }]; assert.ok(L.validate(d).errors.some(e => e.includes('不正'))); });
t('bad date uses JP label', () => { const d = base(); d.deliveryDate = '2026-13-01'; assert.ok(d && L.validate(d).errors.some(e => e.includes('納期の日付が不正'))); });
t('huge amount rejected', () => { const d = base(); d.items = [{ name: 'x', qty: '1e308', unitPrice: '5' }]; d.items[0].qty = '99999999999999999'; assert.ok(L.validate(d).errors.some(e => e.includes('大きすぎ'))); });
console.log(n + ' tests passed');
