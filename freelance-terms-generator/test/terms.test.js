import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, paymentDeadline, generateDocument, parseDate } from '../src/terms.js';

const base = () => ({
  clientName: '株式会社テスト', freelancerName: '山田太郎', orderDate: '2026-04-01',
  workContent: 'ロゴ制作', deliveryDate: '2026-04-30', deliveryPlace: 'メール納品',
  inspection: 'no', amount: '100000', paymentDate: '2026-05-31', paymentMethod: '銀行振込',
});

test('valid input has no errors', () => assert.deepEqual(validate(base()).errors, []));
test('missing required fields flagged', () => {
  const r = validate({});
  assert.ok(r.errors.length >= 9);
});
test('inspection date required only if inspection yes', () => {
  const d = { ...base(), inspection: 'yes' };
  assert.ok(validate(d).errors.some((e) => e.key === 'inspectionDate'));
  assert.ok(!validate(base()).errors.some((e) => e.key === 'inspectionDate'));
});
test('60-day deadline', () => {
  assert.equal(paymentDeadline('2026-04-30'), '2026-06-28');
  const ok = { ...base(), paymentDate: '2026-06-28' };
  assert.deepEqual(validate(ok).errors, []);
  const ng = { ...base(), paymentDate: '2026-06-29' };
  assert.ok(validate(ng).errors.some((e) => e.key === 'paymentDate'));
});
test('invalid dates rejected', () => {
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('abc'), null);
  assert.ok(validate({ ...base(), orderDate: '2026-13-01' }).errors.length > 0);
});
test('amount must be non-negative integer', () => {
  for (const a of ['-1', '1.5', 'abc']) assert.ok(validate({ ...base(), amount: a }).errors.some((e) => e.key === 'amount'));
});
test('payment before delivery rejected', () => {
  assert.ok(validate({ ...base(), paymentDate: '2026-04-10' }).errors.length > 0);
});
test('document contains key items', () => {
  const t = generateDocument(base());
  for (const s of ['山田太郎', 'ロゴ制作', '100,000円', '2026年5月31日', '銀行振込', '検査: なし']) assert.ok(t.includes(s), s);
});

test('amount normalization (comma/fullwidth)', () => {
  assert.deepEqual(validate({ ...base(), amount: '１００,０００円' }).errors, []);
  assert.ok(generateDocument({ ...base(), amount: '100,000' }).includes('100,000円'));
});
test('invalid date message uses label not key', () => {
  const e = validate({ ...base(), orderDate: '2026-13-01' }).errors[0].message;
  assert.ok(e.includes('業務委託をした日') && !e.includes('orderDate'));
});
test('tax note omitted when blank', () => assert.ok(!generateDocument(base()).includes('消費税')));

test('generateDocument refuses invalid input', () => {
  assert.throws(() => generateDocument({ ...base(), inspection: 'yes', inspectionDate: '' }));
});
test('amount cap and zero warning', () => {
  assert.ok(validate({ ...base(), amount: '99999999999999999999' }).errors.some((e) => e.key === 'amount'));
  assert.ok(validate({ ...base(), amount: '0' }).warnings.length > 0);
});
test('leap year deadline', () => assert.equal(paymentDeadline('2028-01-02'), '2028-03-01'));
