import test from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../src/calc.js';

const base = { sales: 5_000_000, purchases: 1_000_000, year: 2026, category: 5,
  baseSales: 4_000_000, invoiceShare: 50, discountPct: 10, firstTime: true };
const get = (r, k) => r.results.find((x) => x.key === k);

test('2割特例: 売上税額の20%', () => {
  const r = compare(base);
  assert.equal(r.outTax, 500_000);
  assert.equal(get(r, 'twenty').tax, 100_000);
  assert.equal(get(r, 'twenty').ok, true);
});
test('2割特例は2027年以降は不可、3割特例が可', () => {
  const r = compare({ ...base, year: 2027 });
  assert.equal(get(r, 'twenty').ok, false);
  assert.equal(get(r, 'thirty').ok, true);
  assert.equal(get(r, 'thirty').tax, 150_000);
});
test('3割特例は2029年は不可', () => {
  assert.equal(get(compare({ ...base, year: 2029 }), 'thirty').ok, false);
});
test('簡易課税 第5種: 50%', () => {
  assert.equal(get(compare(base), 'simplified').tax, 250_000);
});
test('本則: 売上税額-仕入税額、還付は負', () => {
  assert.equal(get(compare(base), 'standard').tax, 400_000);
  assert.equal(get(compare({ ...base, sales: 1_000_000, purchases: 5_000_000 }), 'standard').tax, -400_000);
});
test('免税のまま: 値引き仮定が間接負担', () => {
  assert.equal(get(compare(base), 'exempt').indirect, 250_000);
});
test('基準期間1,000万超は特例・免税不可', () => {
  const r = compare({ ...base, baseSales: 12_000_000 });
  assert.equal(get(r, 'twenty').ok, false);
  assert.equal(get(r, 'exempt').ok, false);
});
test('基準期間5,000万超は簡易課税不可', () => {
  assert.equal(get(compare({ ...base, baseSales: 60_000_000 }), 'simplified').ok, false);
});
test('不正入力(NaN/負数)でも落ちない', () => {
  const r = compare({ ...base, sales: NaN, purchases: -5, invoiceShare: 999 });
  assert.ok(r.results.every((x) => Number.isFinite(x.total)));
});
test('最安は適用可能なものから選ばれる', () => {
  const r = compare({ ...base, year: 2026 });
  assert.ok(r.best);
  assert.ok(get(r, r.best).ok);
});
test('売上0のとき最安は選ばない', () => {
  assert.equal(compare({ ...base, sales: 0 }).best, null);
});
test('同額なら表示順で先を優先', () => {
  const r = compare({ ...base, discountPct: 0 });
  assert.equal(r.best, 'exempt');
});
