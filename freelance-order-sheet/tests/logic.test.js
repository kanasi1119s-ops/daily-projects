import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, hasErrors, buildDocument, daysBetween, parseDate, formatDateJa } from '../src/logic.js';

const base = () => ({
  clientName: '株式会社サンプル', freelancerName: '山田太郎', orderDate: '2026-11-01',
  workContent: 'バナー画像3点の制作（PNG、修正2回まで）', deliveryDate: '2026-11-30', deliveryPlace: 'メール納品',
  inspection: 'no', feeAmount: '50000', taxMode: 'incl', feeMethod: '', paymentDue: '2026-12-25',
  paymentMethod: 'cash', resubcontract: 'no',
});

test('valid input has no errors', () => assert.equal(hasErrors(validate(base())), false));
test('missing fields are errors', () => {
  const f = base(); f.clientName = ''; f.deliveryPlace = ' ';
  const fields = validate(f).filter(i => i.level === 'error').map(i => i.field);
  assert.deepEqual(fields.sort(), ['clientName', 'deliveryPlace']);
});
test('payment >60 days errors', () => {
  const f = base(); f.paymentDue = '2027-02-01';
  assert.ok(validate(f).some(i => i.field === 'paymentDue' && i.level === 'error'));
});
test('payment exactly 60 days warns only', () => {
  const f = base(); f.paymentDue = '2027-01-29';
  const p = validate(f).filter(i => i.field === 'paymentDue');
  assert.equal(p.length, 1); assert.equal(p[0].level, 'warn');
});
test('inspection requires date', () => {
  const f = base(); f.inspection = 'yes';
  assert.ok(validate(f).some(i => i.field === 'inspectionDate' && i.level === 'error'));
});
test('non-cash requires detail', () => {
  const f = base(); f.paymentMethod = 'other';
  assert.ok(validate(f).some(i => i.field === 'paymentMethodDetail'));
});
test('fee method can replace amount', () => {
  const f = base(); f.feeAmount = ''; f.feeMethod = '時給5000円×時間';
  assert.equal(hasErrors(validate(f)), false);
});
test('no fee at all errors', () => {
  const f = base(); f.feeAmount = '';
  assert.ok(validate(f).some(i => i.field === 'feeAmount' && i.level === 'error'));
});
test('negative / non-numeric fee errors', () => {
  for (const x of ['-1', 'abc']) { const f = base(); f.feeAmount = x; assert.ok(hasErrors(validate(f)), x); }
});
test('resubcontract requires original due date', () => {
  const f = base(); f.resubcontract = 'yes';
  assert.ok(validate(f).some(i => i.field === 'originalPaymentDue'));
});
test('date helpers', () => {
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(daysBetween('2026-11-30', '2026-12-30'), 30);
  assert.equal(formatDateJa('2026-11-01'), '2026年11月1日');
});
test('document contains key terms', () => {
  const d = buildDocument(base());
  for (const s of ['株式会社サンプル', '山田太郎', '50,000円（税込）', '2026年12月25日', '検査: なし']) assert.ok(d.includes(s), s);
});
test('document with no fee shows placeholder', () => {
  const f = base(); f.feeAmount = ''; f.feeMethod = '';
  assert.ok(buildDocument(f).includes('5. 報酬の額: （未記入）'));
});
