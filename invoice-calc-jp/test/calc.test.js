import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTax, withholding, transitionalRate, exemptPurchaseCredit, invoiceTotal } from '../calc.js';

test('税抜→税込 10%', () => assert.deepEqual(splitTax(10000), { net: 10000, tax: 1000, gross: 11000 }));
test('端数処理', () => {
  assert.equal(splitTax(105, 'excl', 10, 'floor').tax, 10);
  assert.equal(splitTax(105, 'excl', 10, 'round').tax, 11);
  assert.equal(splitTax(101, 'excl', 10, 'ceil').tax, 11);
});
test('税込→内税逆算', () => assert.deepEqual(splitTax(11000, 'incl'), { net: 10000, tax: 1000, gross: 11000 }));
test('軽減8%', () => assert.equal(splitTax(1000, 'excl', 8).tax, 80));
test('不正入力', () => {
  assert.throws(() => splitTax(-1));
  assert.throws(() => splitTax(1.5));
  assert.throws(() => splitTax(100, 'excl', 5));
  assert.throws(() => splitTax(NaN));
});
test('源泉徴収', () => {
  assert.equal(withholding(100000), 10210);
  assert.equal(withholding(1000000), 102100);
  assert.equal(withholding(1000001), 102100);
  assert.equal(withholding(2000000), 306300);
  assert.equal(withholding(0), 0);
});
test('経過措置割合', () => {
  assert.equal(transitionalRate('2023-09-30'), 100);
  assert.equal(transitionalRate('2023-10-01'), 80);
  assert.equal(transitionalRate('2026-09-30'), 80);
  assert.equal(transitionalRate('2026-10-01'), 50);
  assert.equal(transitionalRate('2029-09-30'), 50);
  assert.equal(transitionalRate('2029-10-01'), 0);
  assert.throws(() => transitionalRate('2026/10/01'));
  assert.throws(() => transitionalRate('2026-13-45'));
});
test('免税事業者控除', () => assert.deepEqual(exemptPurchaseCredit(1000, '2026-11-25'), { rate: 50, deductible: 500, nonDeductible: 500 }));
test('請求書合計', () => assert.deepEqual(invoiceTotal(100000, { withhold: true }), { net: 100000, tax: 10000, gross: 110000, withholding: 10210, payout: 99790 }));
test('上限超過', () => { assert.throws(() => splitTax(2e12)); assert.throws(() => splitTax(Number.MAX_SAFE_INTEGER + 2)); });
