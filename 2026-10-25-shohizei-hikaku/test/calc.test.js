import test from 'node:test';
import assert from 'node:assert/strict';
import { compare, taxIncluded, sensitivity, split } from '../src/calc.js';

const base = { sales10: 11_000_000, sales8: 0, purchase10: 0, purchase8: 0, category: 5,
  eligible: { twenty: true, thirty: true, simplified: true } };

test('税込から消費税を抽出', () => {
  assert.equal(taxIncluded(11_000_000, 0), 1_000_000);
  assert.equal(taxIncluded(0, 10_800), 800);
});

test('2割特例は売上税額の20%', () => {
  const r = compare(base).results.find((x) => x.key === 'twenty');
  assert.equal(r.tax, 200_000);
});

test('簡易課税 第五種は売上税額の50%', () => {
  const r = compare(base).results.find((x) => x.key === 'simplified');
  assert.equal(r.tax, 500_000);
});

test('仕入が多いと原則課税が還付になる', () => {
  const r = compare({ ...base, purchase10: 22_000_000 }).results.find((x) => x.key === 'general');
  assert.equal(r.tax, -1_000_000);
  assert.ok(r.refund);
});

test('対象外の方式は最安に選ばれない', () => {
  const r = compare({ ...base, eligible: { twenty: false, thirty: false, simplified: false } });
  assert.equal(r.bestKey, 'general');
});

test('2割特例が使える場合は最安になる(仕入少)', () => {
  assert.equal(compare(base).bestKey, 'twenty');
});

test('不正値・負値は0扱い', () => {
  const r = compare({ ...base, sales10: -5, purchase10: 'abc' });
  assert.equal(r.salesTax, 0);
  assert.equal(r.purchaseTax, 0);
});

test('感度表は仕入率ごとに行を返す', () => {
  const rows = sensitivity(base);
  assert.equal(rows.length, 10);
  assert.equal(rows[0].ratio, 0);
});

test('国税・地方税の分割が合計と整合', () => {
  const s = split(100_000);
  assert.equal(s.national, 78_000);
  assert.equal(s.local, 22_000);
  assert.equal(s.total, 100_000);
});

test('国税は100円未満切捨て後に地方消費税を算出', () => {
  const s = split(590_909);
  assert.equal(s.national, 460_900);
  assert.equal(s.local, 129_900);
  assert.equal(s.total, 590_800);
});

test('巨大値は上限でクランプされ安全な整数のまま', () => {
  const r = compare({ ...base, sales10: 1e20 });
  assert.ok(Number.isSafeInteger(r.salesTax));
});

test('軽減税率8%のみでも2割特例が計算できる', () => {
  const r = compare({ ...base, sales10: 0, sales8: 5_400_000 }).results.find((x) => x.key === 'twenty');
  assert.equal(r.tax, 80_000);
});
