import test from "node:test";
import assert from "node:assert/strict";
import { simulate, transitionalCreditRate } from "../src/calc.js";

test("税額計算: 税込1,100,000円 → 売上税額100,000円", () => {
  const r = simulate({ sales: 1_100_000, purchases: 0, asOf: "2026-10-17" });
  assert.equal(r.outputTax, 100_000);
  assert.equal(r.methods.twoTenths.tax, 20_000);
  assert.equal(r.methods.simplified.tax, 50_000); // 第5種 50%
  assert.equal(r.methods.honsoku.tax, 100_000);
  assert.equal(r.best, "twoTenths");
});

test("本則課税は経費が多いと有利になる", () => {
  const r = simulate({ sales: 5_500_000, purchases: 4_400_000, twoTenthsEligible: false, asOf: "2026-10-17" });
  assert.equal(r.outputTax, 500_000);
  assert.equal(r.inputTax, 400_000);
  assert.equal(r.methods.honsoku.tax, 100_000);
  assert.equal(r.methods.simplified.tax, 250_000);
  assert.equal(r.methods.twoTenths.tax, null);
  assert.equal(r.best, "honsoku");
});

test("経過措置控除率は日付で切り替わる", () => {
  assert.equal(transitionalCreditRate("2026-09-30"), 0.8);
  assert.equal(transitionalCreditRate("2026-10-01"), 0.5);
  assert.equal(transitionalCreditRate("2029-10-01"), 0);
});

test("非適格仕入れは控除が減る", () => {
  const a = simulate({ sales: 1_100_000, purchases: 550_000, nonQualifiedRatio: 1, asOf: "2026-10-17" });
  assert.equal(a.inputTax, 25_000); // 50,000 × 0.5
});

test("不正入力は例外", () => {
  assert.throws(() => simulate({ sales: -1, purchases: 0 }), RangeError);
  assert.throws(() => simulate({ sales: 1, purchases: 0, businessType: 9 }), RangeError);
  assert.throws(() => simulate({ sales: 1, purchases: 0, nonQualifiedRatio: 2 }), RangeError);
  assert.throws(() => simulate({ sales: 2e12, purchases: 0 }), RangeError);
});

test("売上0でもクラッシュしない", () => {
  const r = simulate({ sales: 0, purchases: 0 });
  assert.equal(r.methods.honsoku.tax, 0);
  assert.equal(r.monthlyReserve, 0);
});

test("還付見込みを返す", () => {
  const r = simulate({ sales: 1_100_000, purchases: 5_500_000, twoTenthsEligible: false, asOf: "2026-10-17" });
  assert.equal(r.methods.honsoku.tax, 0);
  assert.equal(r.refund, 400_000);
});

test("巨額・小数でも整数演算で正確", () => {
  assert.equal(simulate({ sales: 999_999_999_999, purchases: 0 }).outputTax, 90_909_090_909);
  assert.equal(simulate({ sales: 1_100_000.4, purchases: 0 }).outputTax, 100_000);
});
