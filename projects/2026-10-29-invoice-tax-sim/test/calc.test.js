import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, salesTax, purchaseTax, defaultExemptRate } from "../src/calc.js";

const base = { year: 2027, baseSales: 5_000_000, registered: true, category: 5, salesStd: 5_500_000, salesRed: 0, purchStd: 0, purchRed: 0, exemptPurch: 0, exemptRate: 0.7 };
const find = (r, k) => r.results.find((x) => x.key === k);

test("売上税額: 税込110万円(10%)は10万円", () => {
  assert.equal(Math.round(salesTax({ salesStd: 1_100_000, salesRed: 0 })), 100_000);
});
test("軽減税率8%の按分", () => {
  assert.equal(Math.round(salesTax({ salesStd: 0, salesRed: 1_080_000 })), 80_000);
});
test("免税事業者からの仕入れは控除割合を掛ける", () => {
  assert.equal(Math.round(purchaseTax({ exemptPurch: 1_100_000, exemptRate: 0.7 })), 70_000);
});
test("3割特例: 売上税額の30%", () => {
  const r = simulate(base);
  assert.equal(find(r, "thirty").amount, 150_000);
  assert.equal(find(r, "twenty"), undefined);
});
test("簡易課税 第5種は売上税額の50%", () => {
  assert.equal(find(simulate(base), "simple").amount, 250_000);
});
test("仕入が多いと本則が最安で還付になりうる", () => {
  const r = simulate({ ...base, purchStd: 8_800_000 });
  assert.equal(r.bestKey, "general");
  assert.ok(find(r, "general").amount < 0);
});
test("2026年分は2割特例、3割特例は出ない", () => {
  const r = simulate({ ...base, year: 2026 });
  assert.equal(find(r, "twenty").amount, 100_000);
  assert.equal(find(r, "thirty"), undefined);
});
test("2029年分以降は特例なし", () => {
  const r = simulate({ ...base, year: 2029 });
  assert.equal(r.results.length, 2);
});
test("未登録だと特例は不可", () => {
  const r = simulate({ ...base, registered: false });
  assert.equal(find(r, "thirty").eligible, false);
  assert.notEqual(r.bestKey, "thirty");
});
test("基準期間5,000万円超は簡易課税不可", () => {
  const r = simulate({ ...base, baseSales: 60_000_000 });
  assert.equal(find(r, "simple").eligible, false);
  assert.equal(r.bestKey, "general");
});
test("不正入力(NaN/負数)でも落ちない", () => {
  const r = simulate({ ...base, salesStd: NaN, purchStd: -5, exemptRate: NaN });
  assert.equal(r.salesTax, 0);
  assert.equal(find(r, "general").amount, 0);
});
test("控除割合のデフォルト", () => {
  assert.equal(defaultExemptRate(2027), 0.7);
  assert.equal(defaultExemptRate(2031), 0.3);
});
test("還付は0方向へ切捨て", () => {
  const r = simulate({ ...base, salesStd: 0, purchStd: 1_000_000 });
  assert.equal(find(r, "general").amount, -90_909);
});
test("控除割合100%超は100%に丸める", () => {
  assert.equal(Math.round(purchaseTax({ exemptPurch: 1_100_000, exemptRate: 5 })), 100_000);
});
test("2026年分で基準期間1,000万円超は2割特例不可", () => {
  const r = simulate({ ...base, year: 2026, baseSales: 20_000_000 });
  assert.equal(find(r, "twenty").eligible, false);
});
