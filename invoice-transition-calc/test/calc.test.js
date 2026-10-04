import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcLine, deductionPct, summarize, isValidDate } from '../src/calc.js';

test('控除率スケジュールの境界', () => {
  assert.equal(deductionPct('2023-09-30').pct, 100);
  assert.equal(deductionPct('2023-10-01').pct, 80);
  assert.equal(deductionPct('2026-09-30').pct, 80);
  assert.equal(deductionPct('2026-10-01').pct, 70);
  assert.equal(deductionPct('2028-09-30').pct, 70);
  assert.equal(deductionPct('2028-10-01').pct, 50);
  assert.equal(deductionPct('2030-09-30').pct, 50);
  assert.equal(deductionPct('2030-10-01').pct, 30);
  assert.equal(deductionPct('2031-09-30').pct, 30);
  assert.equal(deductionPct('2031-10-01').pct, 0);
});

test('税込110,000円・10%・2026-10-01 は消費税10,000円のうち7,000円控除', () => {
  const r = calcLine({ amount: 110000, date: '2026-10-01' });
  assert.deepEqual([r.tax, r.base, r.pct, r.deductible, r.nonDeductible], [10000, 100000, 70, 7000, 3000]);
});

test('税抜入力・軽減8%', () => {
  const r = calcLine({ amount: 100000, taxIncluded: false, taxRate: 8, date: '2026-09-30' });
  assert.deepEqual([r.tax, r.deductible, r.nonDeductible], [8000, 6400, 1600]);
});

test('適格請求書発行事業者からの仕入れは全額控除', () => {
  const r = calcLine({ amount: 110000, date: '2030-10-01', supplier: 'qualified' });
  assert.equal(r.nonDeductible, 0);
});

test('端数処理(切捨て/四捨五入/切上げ)', () => {
  // 税込 1,000円 → 1000*10/110 = 90.9
  assert.equal(calcLine({ amount: 1000, date: '2026-10-01', rounding: 'floor' }).tax, 90);
  assert.equal(calcLine({ amount: 1000, date: '2026-10-01', rounding: 'ceil' }).tax, 91);
  assert.equal(calcLine({ amount: 1000, date: '2026-10-01', rounding: 'round' }).tax, 91);
});

test('合計は各行の合計と一致し、控除+非控除=税額', () => {
  const rows = [
    calcLine({ amount: 12345, date: '2026-10-01' }),
    calcLine({ amount: 6789, taxRate: 8, date: '2028-10-01' }),
  ];
  const s = summarize(rows);
  assert.equal(s.deductible + s.nonDeductible, s.tax);
});

test('不正入力は例外', () => {
  assert.throws(() => calcLine({ amount: -1, date: '2026-10-01' }), RangeError);
  assert.throws(() => calcLine({ amount: 1.5, date: '2026-10-01' }), RangeError);
  assert.throws(() => calcLine({ amount: 100, taxRate: 5, date: '2026-10-01' }), RangeError);
  assert.throws(() => calcLine({ amount: 100, date: '2026-02-30' }), RangeError);
  assert.equal(isValidDate('2026-02-29'), false);
  assert.equal(isValidDate('2028-02-29'), true);
});

test('適格事業者でも日付が不正なら例外(入力不整合を見逃さない)', () => {
  assert.throws(() => calcLine({ amount: 100, date: '', supplier: 'qualified' }), RangeError);
});

test('0円・大きな金額でも 控除+非控除=税額', () => {
  for (const amount of [0, 1, 9, 10, 11, 999999999999]) {
    for (const rounding of ['floor', 'round', 'ceil']) {
      const r = calcLine({ amount, date: '2028-10-01', rounding });
      assert.equal(r.deductible + r.nonDeductible, r.tax);
      assert.ok(r.nonDeductible >= 0 || rounding === 'ceil');
    }
  }
});
