const test = require('node:test');
const assert = require('node:assert');
const L = require('../lib.js');

const base = () => ({
  clientName: '株式会社サンプル', freelancerName: '山田太郎',
  orderDate: '2026-11-01', workContent: 'ロゴデザイン1点',
  deliveryDate: '2026-11-30', deliveryPlace: 'メール納品',
  feeType: 'fixed', feeAmount: '100000', taxIncluded: true,
  paymentDate: '2026-12-25', paymentMethod: 'bank', hasInspection: false,
});

test('valid input has no errors', () => {
  const r = L.validate(base());
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.warnings, []);
});

test('parseDate rejects invalid dates', () => {
  assert.strictEqual(L.parseDate('2026-02-30'), null);
  assert.strictEqual(L.parseDate('2026/02/01'), null);
  assert.ok(L.parseDate('2028-02-29'));
});

test('60 day rule warns', () => {
  const f = base(); f.paymentDate = '2027-02-01';
  assert.strictEqual(L.validate(f).warnings.length, 1);
  f.paymentDate = '2027-01-29'; // exactly 60 days
  assert.strictEqual(L.validate(f).warnings.length, 0);
});

test('required fields', () => {
  const r = L.validate({});
  const fields = r.errors.map(e => e.field);
  ['clientName', 'freelancerName', 'workContent', 'deliveryPlace', 'orderDate', 'deliveryDate', 'paymentDate', 'feeAmount'].forEach(x => assert.ok(fields.includes(x), x));
});

test('fee amount must be positive integer', () => {
  for (const v of ['0', '-5', '1.5', 'abc', '']) {
    const f = base(); f.feeAmount = v;
    assert.ok(L.validate(f).errors.some(e => e.field === 'feeAmount'), v);
  }
});

test('fee method mode', () => {
  const f = base(); f.feeType = 'method'; f.feeMethod = '';
  assert.ok(L.validate(f).errors.some(e => e.field === 'feeMethod'));
  f.feeMethod = '時給5000円×稼働時間';
  assert.strictEqual(L.validate(f).errors.length, 0);
  assert.match(L.generate(f), /算定方法: 時給5000円×稼働時間/);
});

test('inspection and other payment method', () => {
  const f = base(); f.hasInspection = true;
  assert.ok(L.validate(f).errors.some(e => e.field === 'inspectionDate'));
  f.inspectionDate = '2026-12-05';
  assert.strictEqual(L.validate(f).errors.length, 0);
  f.paymentMethod = 'other';
  assert.ok(L.validate(f).errors.some(e => e.field === 'paymentMethodDetail'));
});

test('generate output', () => {
  const t = L.generate(base());
  assert.match(t, /100,000円\(消費税込\)/);
  assert.match(t, /2026年12月25日/);
  assert.match(t, /検査: 行わない/);
});

test('round1: fee upper bound and bank wording', () => {
  const f = base(); f.feeAmount = '1e21';
  assert.ok(L.validate(f).errors.some(e => e.field === 'feeAmount'));
  f.feeAmount = '1000000000000';
  assert.strictEqual(L.validate(f).errors.length, 0);
  assert.match(L.generate(base()), /支払方法: 銀行振込$/m);
});
