import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, addDays, paymentDeadline, checkPaymentDate, validateSpec, renderSpec, evaluateProhibited, endOfNextMonth } from '../src/logic.js';

const base = { clientName: 'A社', freelancerName: '山田', orderDate: '2026-12-01', workDescription: 'デザイン', deliveryDate: '2026-12-20', payDate: '2027-01-31', reward: '150000', payMethod: '銀行振込', feeBearer: 'client' };

test('parseDate strict', () => {
  assert.ok(parseDate('2026-02-28') !== null);
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('2026/02/01'), null);
  assert.equal(parseDate(''), null);
});
test('paymentDeadline: day1 = receipt, 60th day', () => {
  assert.equal(paymentDeadline('2026-12-20'), '2027-02-17');
  assert.equal(paymentDeadline('2026-01-01'), '2026-03-01');
});
test('addDays across leap year', () => { assert.equal(addDays('2028-02-28', 1), '2028-02-29'); });
test('checkPaymentDate', () => {
  assert.deepEqual(checkPaymentDate('2026-12-20', '2027-02-17'), { ok: true, valid: true, deadline: '2027-02-17', overDays: 0 });
  assert.equal(checkPaymentDate('2026-12-20', '2027-02-18').overDays, 1);
  assert.equal(checkPaymentDate('bad', '2027-02-18').valid, false);
});
test('endOfNextMonth', () => { assert.equal(endOfNextMonth('2026-12-05'), '2027-01-31'); assert.equal(endOfNextMonth('2027-01-31'), '2027-02-28'); });
test('validateSpec ok', () => { const r = validateSpec(base); assert.deepEqual(r.errors, []); assert.deepEqual(r.warnings, []); });
test('validateSpec missing required', () => { assert.ok(validateSpec({}).errors.length >= 6); });
test('validateSpec reward or calc', () => {
  assert.ok(validateSpec({ ...base, reward: '', rewardCalc: '' }).errors.some((e) => e.includes('報酬')));
  assert.deepEqual(validateSpec({ ...base, reward: '', rewardCalc: '時給5000円' }).errors, []);
  assert.ok(validateSpec({ ...base, reward: '-5' }).errors.length > 0);
  assert.ok(validateSpec({ ...base, reward: 'abc' }).errors.length > 0);
});
test('validateSpec 60-day warning', () => {
  const r = validateSpec({ ...base, payDate: '2027-03-31' });
  assert.ok(r.warnings.some((w) => w.includes('60日')));
});
test('validateSpec fee bearer warning', () => { assert.ok(validateSpec({ ...base, feeBearer: 'freelancer' }).warnings.length === 1); });
test('validateSpec bad date', () => { assert.ok(validateSpec({ ...base, deliveryDate: '2026-02-30' }).errors.some((e) => e.includes('形式'))); });
test('renderSpec contains key items', () => {
  const t = renderSpec(base);
  for (const s of ['A社', '山田', '2026年12月1日', '150,000円', '2027年1月31日', '銀行振込', '発注事業者負担']) assert.ok(t.includes(s), s);
});
test('evaluateProhibited', () => {
  assert.equal(evaluateProhibited({ cut: true, refuse: false }).hits.length, 1);
  assert.equal(evaluateProhibited({ cut: true }, 0).applicable, false);
});

test('reward: 全角数字・カンマ', () => {
  assert.deepEqual(validateSpec({ ...base, reward: '１５０，０００' }).errors, []);
  assert.ok(renderSpec({ ...base, reward: '１５０，０００' }).includes('150,000円'));
});
test('reward: 小数は不可', () => { assert.ok(validateSpec({ ...base, reward: '1000.5' }).errors.length > 0); });
test('非銀行振込で補足なしは警告', () => { assert.ok(validateSpec({ ...base, payMethod: '現金' }).warnings.length === 1); });
