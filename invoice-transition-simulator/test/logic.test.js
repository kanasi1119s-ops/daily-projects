import test from "node:test";
import assert from "node:assert/strict";
import {
  transitionalRatio, nationalTaxFromGross, unregisteredPurchase, withLocal,
  availableSpecials, compareMethods,
} from "../src/logic.js";

test("経過措置の境界日", () => {
  assert.equal(transitionalRatio("2023-09-30"), 1);
  assert.equal(transitionalRatio("2023-10-01"), 0.8);
  assert.equal(transitionalRatio("2026-09-30"), 0.8);
  assert.equal(transitionalRatio("2026-10-01"), 0.7);
  assert.equal(transitionalRatio("2028-09-30"), 0.7);
  assert.equal(transitionalRatio("2028-10-01"), 0.5);
  assert.equal(transitionalRatio("2030-10-01"), 0.3);
  assert.equal(transitionalRatio("2031-10-01"), 0);
});

test("不正な日付は例外", () => {
  assert.throws(() => transitionalRatio("2026/10/01"), RangeError);
  assert.throws(() => transitionalRatio("2026-13-45"), RangeError);
  assert.throws(() => transitionalRatio(undefined), RangeError);
});

test("国税分の計算(切捨て)", () => {
  assert.equal(nationalTaxFromGross(110000, 10), 7800);
  assert.equal(nationalTaxFromGross(108000, 8), 6240);
  assert.equal(nationalTaxFromGross(0, 10), 0);
  assert.throws(() => nationalTaxFromGross(-1, 10), RangeError);
  assert.throws(() => nationalTaxFromGross(100, 5), RangeError);
});

test("免税事業者からの仕入れ", () => {
  const r = unregisteredPurchase(110000, 10, "2026-10-01");
  assert.deepEqual(r, { tax: 7800, ratio: 0.7, deductible: 5460, nonDeductible: 2340 });
});

test("地方消費税加算", () => {
  assert.equal(withLocal(7800), 7800 + 2200);
});

test("特例の利用可能年", () => {
  assert.deepEqual(availableSpecials(2026), { niwari: true, sanwari: false });
  assert.deepEqual(availableSpecials(2027), { niwari: false, sanwari: true });
  assert.deepEqual(availableSpecials(2029), { niwari: false, sanwari: false });
});

test("方式比較: 2026年分は2割特例が最安", () => {
  const r = compareMethods({ taxYear: 2026, sales10: 5_500_000, businessType: 5 });
  assert.equal(r.salesTax, 390000);
  const n = r.results.find((x) => x.key === "niwari");
  assert.equal(n.national, 78000);
  assert.equal(r.cheapest, "niwari");
  assert.ok(!r.results.some((x) => x.key === "sanwari"));
});

test("方式比較: 2027年分は3割特例が出て2割特例は出ない", () => {
  const r = compareMethods({ taxYear: 2027, sales10: 5_500_000, businessType: 5 });
  assert.ok(r.results.some((x) => x.key === "sanwari"));
  assert.ok(!r.results.some((x) => x.key === "niwari"));
});

test("本則課税は仕入税額控除で下限0", () => {
  const r = compareMethods({ taxYear: 2029, sales10: 110000, purchases10: 1_100_000 });
  assert.equal(r.results.find((x) => x.key === "honsoku").national, 0);
});

test("入力検証", () => {
  assert.throws(() => compareMethods({ taxYear: 2026, sales10: -1 }), RangeError);
  assert.throws(() => compareMethods({ taxYear: 2026, businessType: 9 }), RangeError);
  assert.throws(() => compareMethods({ taxYear: 2026, unregRatio: 2 }), RangeError);
  assert.throws(() => compareMethods({ taxYear: "abc" }), RangeError);
});
