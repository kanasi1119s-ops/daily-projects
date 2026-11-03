import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, formatYen } from "../src/calc.js";

const base = { sales: 5_000_000, purchases: 1_000_000, baseYearSales: 4_000_000, businessType: 5, taxYear: "R8", isIndividual: true, registeredFromExempt: true };
const get = (r, k) => r.results.find((x) => x.key === k);

test("R8: 2割特例は売上税額の20%", () => {
  const r = calculate(base);
  assert.equal(r.salesTax, 500_000);
  assert.equal(get(r, "nitowari").tax, 100_000);
  assert.equal(get(r, "honsoku").tax, 400_000);
  assert.equal(get(r, "kani").tax, 250_000);
  assert.equal(r.best.key, "nitowari");
  assert.equal(r.savingVsWorst, 300_000);
});

test("R9: 3割特例は個人のみ・売上税額の30%", () => {
  const r = calculate({ ...base, taxYear: "R9" });
  assert.equal(get(r, "sanwari").tax, 150_000);
  assert.equal(get(r, "nitowari"), undefined);
  const c = calculate({ ...base, taxYear: "R9", isIndividual: false });
  assert.equal(get(c, "sanwari").eligible, false);
});

test("R11以降は特例なし", () => {
  const r = calculate({ ...base, taxYear: "R11" });
  assert.equal(r.results.length, 2);
});

test("基準期間1,000万円超で特例不可、5,000万円超で簡易不可", () => {
  const r = calculate({ ...base, baseYearSales: 10_000_001 });
  assert.equal(get(r, "nitowari").eligible, false);
  assert.equal(get(r, "kani").eligible, true);
  assert.equal(r.exemptHint, null);
  const r2 = calculate({ ...base, baseYearSales: 50_000_001 });
  assert.equal(get(r2, "kani").eligible, false);
  assert.equal(r2.best.key, "honsoku");
});

test("仕入が多いと本則が最安・還付はマイナス", () => {
  const r = calculate({ ...base, sales: 1_000_000, purchases: 5_000_000 });
  assert.equal(get(r, "honsoku").tax, -400_000);
  assert.equal(r.best.key, "honsoku");
});

test("境界値: 基準期間ちょうど1,000万円は特例可", () => {
  const r = calculate({ ...base, baseYearSales: 10_000_000 });
  assert.equal(get(r, "nitowari").eligible, true);
});

test("登録を機に課税になっていない場合は特例不可", () => {
  const r = calculate({ ...base, registeredFromExempt: false });
  assert.equal(get(r, "nitowari").eligible, false);
  assert.equal(r.best.key, "kani");
});

test("不正入力は例外", () => {
  assert.throws(() => calculate({ ...base, sales: -1 }), RangeError);
  assert.throws(() => calculate({ ...base, sales: "abc" }), RangeError);
  assert.throws(() => calculate({ ...base, businessType: 9 }), RangeError);
  assert.throws(() => calculate({ ...base, taxYear: "X" }), RangeError);
  assert.throws(() => calculate({ ...base, sales: 1e15 }), RangeError);
});

test("端数は切り捨て", () => {
  const r = calculate({ ...base, sales: 1_234_567, purchases: 0 });
  assert.equal(r.salesTax, 123_456);
});

test("formatYen", () => {
  assert.equal(formatYen(1234567), "¥1,234,567");
  assert.equal(formatYen(-5), "−¥5");
});
