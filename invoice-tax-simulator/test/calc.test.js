import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, splitTax, taxPortion } from "../src/calc.js";

const base = { sales: 5_500_000, purchases: 1_100_000, baseSales: 5_000_000, category: 5, year: 2026 };
const find = (r, k) => r.results.find((x) => x.key === k);

test("taxPortion は10/110", () => {
  assert.equal(taxPortion(1100), 100);
});

test("本則課税: 売上税額50万 − 仕入税額10万 = 40万", () => {
  const r = simulate(base);
  assert.equal(find(r, "standard").total, 400_000);
});

test("簡易課税(第5種): 50万 × 50% = 25万", () => {
  const r = simulate(base);
  assert.equal(find(r, "simplified").total, 250_000);
});

test("2割特例: 50万 × 20% = 10万 が最有利", () => {
  const r = simulate(base);
  assert.equal(find(r, "special20").total, 100_000);
  assert.equal(find(r, "special20").isBest, true);
});

test("2027年は3割特例のみ、2割特例は出ない", () => {
  const r = simulate({ ...base, year: 2027 });
  assert.equal(find(r, "special20"), undefined);
  assert.equal(find(r, "special30").total, 150_000);
});

test("2029年は特例なし", () => {
  const r = simulate({ ...base, year: 2029 });
  assert.equal(r.results.length, 2);
});

test("基準期間1,000万超は特例が対象外で、最有利に選ばれない", () => {
  const r = simulate({ ...base, baseSales: 12_000_000 });
  assert.equal(find(r, "special20").eligible, false);
  assert.equal(find(r, "special20").isBest, false);
  assert.equal(find(r, "simplified").isBest, true);
});

test("基準期間5,000万超は簡易課税が対象外", () => {
  const r = simulate({ ...base, baseSales: 60_000_000, year: 2029 });
  assert.equal(find(r, "simplified").eligible, false);
  assert.equal(find(r, "standard").isBest, true);
});

test("経費が多いと本則が還付になる", () => {
  const r = simulate({ ...base, sales: 1_100_000, purchases: 5_500_000, year: 2029 });
  assert.ok(find(r, "standard").total < 0);
  assert.equal(find(r, "standard").isBest, true);
});

test("国税+地方税が合計と一致し、100円未満は切り捨て", () => {
  const s = splitTax(123_456);
  assert.equal(s.total, s.national + s.local);
  assert.equal(s.national % 100, 0);
  assert.equal(s.local % 100, 0);
});

test("売上0でも例外にならない", () => {
  const r = simulate({ ...base, sales: 0, purchases: 0 });
  assert.deepEqual(r.errors, []);
  assert.equal(find(r, "special20").total, 0);
});

test("不正入力はエラーを返す", () => {
  for (const bad of [{ sales: -1 }, { sales: NaN }, { purchases: "a" }, { category: 9 }, { year: 2030 }, { sales: 1e13 }]) {
    const r = simulate({ ...base, ...bad });
    assert.ok(r.errors.length > 0, JSON.stringify(bad));
    assert.deepEqual(r.results, []);
  }
});

import { parseYen } from "../src/calc.js";

test("parseYen: カンマ・全角・円記号・空欄", () => {
  assert.equal(parseYen("5,500,000"), 5_500_000);
  assert.equal(parseYen("５，５００円"), 5500);
  assert.equal(parseYen("¥ 1 000"), 1000);
  assert.equal(parseYen(""), 0);
  assert.ok(Number.isNaN(parseYen("abc")));
  assert.ok(Number.isNaN(parseYen("-5")));
  assert.ok(Number.isNaN(parseYen("1.5")));
});

test("還付の分解は符号対称", () => {
  const p = splitTax(123_456), n = splitTax(-123_456);
  assert.equal(n.total, -p.total);
  assert.equal(n.national, -p.national);
});

test("税額は円未満切り捨てで、表示値と計算値が一致する", () => {
  const r = simulate({ ...base, sales: 1_000_000, purchases: 0, year: 2029 });
  assert.equal(r.outputTax, 90_909);
  assert.equal(find(r, "standard").total, 90_800);
});
