import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, taxIncluded } from '../src/tax.js';

const get = (r, k) => r.methods.find((m) => m.key === k);

test('税込110万円に含まれる消費税は10万円', () => {
  assert.equal(Math.round(taxIncluded(1_100_000)), 100_000);
});

test('本則: 売上550万・仕入220万 → 納税30万円', () => {
  const r = simulate({ sales: 5_500_000, purchases: 2_200_000, businessType: 5, taxYear: 2027 });
  assert.equal(get(r, 'general').tax, 300_000);
});

test('簡易: 第5種 売上550万 → 売上税額50万×50% = 25万円', () => {
  const r = simulate({ sales: 5_500_000, purchases: 0, businessType: 5 });
  assert.equal(get(r, 'simplified').tax, 250_000);
});

test('2割特例: 2026年分は対象、2027年分は対象外', () => {
  const a = simulate({ sales: 5_500_000, purchases: 0, businessType: 5, taxYear: 2026 });
  const b = simulate({ sales: 5_500_000, purchases: 0, businessType: 5, taxYear: 2027 });
  assert.equal(get(a, 'twenty').eligible, true);
  assert.equal(get(a, 'twenty').tax, 100_000);
  assert.equal(get(b, 'twenty').eligible, false);
});

test('もともと課税事業者だった場合は2割特例対象外', () => {
  const r = simulate({ sales: 5_500_000, purchases: 0, businessType: 5, taxYear: 2026, wasExempt: false });
  assert.equal(get(r, 'twenty').eligible, false);
});

test('基準期間売上が5,000万円超なら簡易課税は不可', () => {
  const r = simulate({ sales: 60_000_000, purchases: 0, businessType: 1, baseYearSales: 55_000_000 });
  assert.equal(get(r, 'simplified').eligible, false);
});

test('最小納税額の方式が選ばれる（仕入が多いと本則が有利）', () => {
  const r = simulate({ sales: 11_000_000, purchases: 9_900_000, businessType: 5, baseYearSales: 20_000_000 });
  assert.equal(r.bestKey, 'general');
});

test('仕入が売上を上回ると本則は還付（負の値）', () => {
  const r = simulate({ sales: 1_100_000, purchases: 2_200_000, businessType: 3 });
  assert.equal(get(r, 'general').tax, -100_000);
});

test('100円未満は切り捨て', () => {
  const r = simulate({ sales: 1_234_567, purchases: 0, businessType: 5 });
  assert.equal(get(r, 'general').tax % 100, 0);
});

test('不正入力はエラー', () => {
  assert.equal(simulate({ sales: -1, purchases: 0, businessType: 5 }).ok, false);
  assert.equal(simulate({ sales: NaN, purchases: 0, businessType: 5 }).ok, false);
  assert.equal(simulate({ sales: 1, purchases: 0, businessType: 9 }).ok, false);
});

import { parseYen } from '../src/parse.js';

test('parseYen: カンマ・全角・円を処理', () => {
  assert.equal(parseYen('5,500,000'), 5_500_000);
  assert.equal(parseYen('５５００，０００円'), 5_500_000);
  assert.ok(Number.isNaN(parseYen('')));
  assert.ok(Number.isNaN(parseYen('-100')));
  assert.ok(Number.isNaN(parseYen('1.5')));
});

test('基準期間売上が不正値(NaN)・桁外れならエラー', () => {
  assert.equal(simulate({ sales: 1, purchases: 0, businessType: 5, baseYearSales: NaN }).ok, false);
  assert.equal(simulate({ sales: 1e20, purchases: 0, businessType: 5 }).ok, false);
  assert.equal(simulate({ sales: 1, purchases: 0, businessType: 5, baseYearSales: undefined }).ok, true);
});
