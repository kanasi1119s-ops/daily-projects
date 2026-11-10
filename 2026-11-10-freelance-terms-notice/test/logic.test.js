const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/logic.js');

const base = { clientName: 'A社', freelancerName: '山田', orderDate: '2026-11-01', scope: 'LP制作',
  amount: '100000', paymentDate: '2026-12-25', deliveryDate: '2026-11-30', taxMode: 'excl', taxRate: 10 };

test('valid input has no errors', () => assert.deepStrictEqual(L.validate(base).errors, []));
test('missing required', () => assert.ok(L.validate({}).errors.length >= 6));
test('60-day warning', () => {
  const r = L.validate({ ...base, paymentDate: '2027-03-01' });
  assert.strictEqual(r.warnings.length, 1);
});
test('exactly 60 days ok', () => assert.ok(L.paymentDeadlineCheck('2026-11-30', '2027-01-29').ok));
test('61 days not ok', () => assert.strictEqual(L.paymentDeadlineCheck('2026-11-30', '2027-01-30').ok, false));
test('payment before delivery is error', () =>
  assert.ok(L.validate({ ...base, paymentDate: '2026-11-01' }).errors.length > 0));
test('invalid date rejected', () => assert.strictEqual(L.parseDate('2026-02-30'), null));
test('leap day ok', () => assert.ok(L.parseDate('2028-02-29')));
test('tax exclusive', () => assert.deepStrictEqual(L.calcAmounts(100000, 'excl', 10), { excl: 100000, tax: 10000, incl: 110000 }));
test('tax inclusive', () => assert.deepStrictEqual(L.calcAmounts(110000, 'incl', 10), { excl: 100000, tax: 10000, incl: 110000 }));
test('negative amount null', () => assert.strictEqual(L.calcAmounts(-1, 'excl', 10), null));
test('inspection requires date', () =>
  assert.ok(L.validate({ ...base, hasInspection: true }).errors.some(e => e.includes('検査'))));
test('non-bank payment requires detail', () =>
  assert.ok(L.validate({ ...base, paymentMethod: 'other' }).errors.length > 0));
test('delivery before order is error', () =>
  assert.ok(L.validate({ ...base, deliveryDate: '2026-10-01' }).errors.length > 0));
test('document contains key items', () => {
  const d = L.buildDocument(base);
  ['A社', '山田', 'LP制作', '¥110,000', '2026年12月25日'].forEach(s => assert.ok(d.includes(s), s));
});
test('escapeHtml', () => assert.strictEqual(L.escapeHtml('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;'));
test('non-integer amount is error', () => assert.ok(L.validate({ ...base, amount: '100.5' }).errors.length > 0));
test('zero amount warns', () => assert.ok(L.validate({ ...base, amount: '0' }).warnings.length > 0));
test('blank tax rate is error', () => assert.ok(L.validate({ ...base, taxRate: '' }).errors.length > 0));
test('inspection before delivery warns', () =>
  assert.ok(L.validate({ ...base, hasInspection: true, inspectionDate: '2026-11-01' }).warnings.length > 0));
test('bad date message uses Japanese label', () =>
  assert.ok(L.validate({ ...base, deliveryDate: '2026-13-01' }).errors.some(e => e.includes('納期'))));
test('payment before order is error', () =>
  assert.ok(L.validate({ ...base, deliveryDate: '', paymentDate: '2026-10-01' }).errors.length > 0));
test('8% rate rounding', () => assert.deepStrictEqual(L.calcAmounts(1999, 'excl', 8), { excl: 1999, tax: 159, incl: 2158 }));
