import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, getRate, taxIncluded, calcLine, calcTotal, projection } from '../src/calc.js';

test('parseAmount', () => {
  assert.equal(parseAmount('１,１００円'), 1100);
  assert.equal(parseAmount('1 000'), 1000);
  assert.ok(Number.isNaN(parseAmount('-5')));
  assert.ok(Number.isNaN(parseAmount('')));
  assert.ok(Number.isNaN(parseAmount('1.5')));
  assert.ok(Number.isNaN(parseAmount(-1)));
});
test('getRate boundaries', () => {
  assert.equal(getRate('2023-09-30'), 1);
  assert.equal(getRate('2023-10-01'), 0.8);
  assert.equal(getRate('2026-09-30'), 0.8);
  assert.equal(getRate('2026-10-01'), 0.7);
  assert.equal(getRate('2031-09-30'), 0.3);
  assert.equal(getRate('2031-10-01'), 0);
  assert.throws(() => getRate('2026-13-45'));
  assert.throws(() => getRate('abc'));
});
test('upper bound', () => {
  assert.ok(Number.isNaN(parseAmount('9000000000000000')));
  assert.equal(calcLine({ amount: 1e13, date: '2026-10-15' }).deductible, 636363636363);
});
test('taxIncluded', () => {
  assert.equal(taxIncluded(110000, 10), 10000);
  assert.equal(taxIncluded(108000, 8), 8000);
  assert.equal(taxIncluded(999, 10), 90);
  assert.throws(() => taxIncluded(100, 5));
});
test('calcLine transition', () => {
  const r = calcLine({ amount: 110000, date: '2026-10-15' });
  assert.deepEqual([r.tax, r.rate, r.deductible, r.nonDeductible, r.rule], [10000, 0.7, 7000, 3000, 'transition']);
});
test('calcLine float safety', () => {
  const r = calcLine({ amount: 11, date: '2026-10-15' }); // tax 1 * 0.7
  assert.equal(r.deductible, 0);
  const s = calcLine({ amount: 1100 * 3, date: '2026-10-15' }); // tax 300 *0.7 = 210
  assert.equal(s.deductible, 210);
});
test('small amount special', () => {
  assert.equal(calcLine({ amount: 9999, date: '2026-10-15', smallAmountSpecial: true }).nonDeductible, 0);
  assert.equal(calcLine({ amount: 10000, date: '2026-10-15', smallAmountSpecial: true }).rule, 'transition');
  assert.equal(calcLine({ amount: 5000, date: '2029-10-01', smallAmountSpecial: true }).rule, 'transition');
  assert.equal(calcLine({ amount: 5000, date: '2026-10-15' }).rule, 'transition');
});
test('calcTotal', () => {
  const t = calcTotal([{ amount: 110000, date: '2026-10-15' }, { amount: 55000, date: '2026-09-01' }]);
  assert.equal(t.tax, 15000);
  assert.equal(t.deductible, 7000 + 4000);
  assert.equal(t.nonDeductible, 4000);
});
test('projection', () => {
  const p = projection(1100000);
  assert.equal(p.length, 5);
  assert.equal(p[1].nonDeductible, 30000);
  assert.equal(p[4].nonDeductible, 100000);
  assert.throws(() => projection('abc'));
});
