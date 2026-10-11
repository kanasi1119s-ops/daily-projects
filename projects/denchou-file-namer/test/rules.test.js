import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDate, normalizeAmount, sanitizePart, buildFileName, dedupe, csvCell, toCsv } from "../src/rules.js";

test("normalizeDate: 各種形式", () => {
  assert.equal(normalizeDate("2026-10-11"), "20261011");
  assert.equal(normalizeDate("2026/1/2"), "20260102");
  assert.equal(normalizeDate("20261011"), "20261011");
  assert.equal(normalizeDate("２０２６年１０月１１日"), "20261011");
  assert.equal(normalizeDate("令和8年1月2日"), "20260102");
  assert.equal(normalizeDate("R8.1.2"), "20260102");
  assert.equal(normalizeDate("令和元年5月1日"), "20190501");
  assert.equal(normalizeDate("H31.4.30"), "20190430");
});
test("normalizeDate: 不正", () => {
  for (const s of ["", "2026-02-30", "2026-13-01", "abc", "2025/2/29", "99991231", null])
    assert.equal(normalizeDate(s), null, String(s));
  assert.equal(normalizeDate("2024-02-29"), "20240229");
  // 和暦の範囲外(元年0、改元前後)
  for (const x of ["R0.1.1", "令和0年1月1日", "平成31年5月1日", "令和1年4月30日", "H1.1.7", "S64.1.8"]) assert.equal(normalizeDate(x), null, x);
  assert.equal(normalizeDate("平成31年4月30日"), "20190430");
  assert.equal(normalizeDate("S64.1.7"), "19890107");
});
test("normalizeAmount", () => {
  assert.equal(normalizeAmount("¥12,000"), "12000");
  assert.equal(normalizeAmount("１２，３４５円"), "12345");
  assert.equal(normalizeAmount("0"), "0");
  for (const s of ["", "-100", "1.5", "abc", "99999999999999999999"]) assert.equal(normalizeAmount(s), null, s);
});
test("sanitizePart", () => {
  assert.equal(sanitizePart('a/b:c*d?"e<f>g|h'), "abcdefgh");
  assert.equal(sanitizePart("  ㈱ テスト  商事 "), "(株) テスト 商事");
  assert.equal(sanitizePart("..hidden.."), "hidden");
  assert.equal(sanitizePart("あ".repeat(100)).length, 40);
});
test("buildFileName", () => {
  const r = buildFileName({ original: "scan001.PDF", date: "R8.10.11", vendor: "株式会社テスト", amount: "¥12,000", type: "領収書" });
  assert.deepEqual([r.ok, r.name], [true, "20261011_株式会社テスト_12000_領収書.pdf"]);
  const r2 = buildFileName({ original: "x.png", date: "2026-10-11", vendor: "A社", amount: "500", type: "請求書", order: "vendor-date-amount" });
  assert.equal(r2.name, "A社_20261011_500_請求書.png");
  const bad = buildFileName({ original: "x.pdf", date: "x", vendor: "", amount: "x", type: "" });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 3);
});
test("buildFileName: 拡張子なし・パス区切りは除去", () => {
  const r = buildFileName({ original: "noext", date: "20260101", vendor: "../evil", amount: "1", type: "" });
  assert.equal(r.name, "20260101_evil_1");
});
test("dedupe", () => {
  assert.deepEqual(dedupe(["a.pdf", "A.pdf", "b.pdf", "", "a.pdf"]), ["a.pdf", "A_2.pdf", "b.pdf", "", "a_3.pdf"]);
});
test("csv: 式インジェクション対策とエスケープ", () => {
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  const c = toCsv([{ name: "n", original: "o", date: "d", vendor: "v", amount: "1", type: "t" }]);
  assert.ok(c.startsWith("﻿新ファイル名"));
  assert.ok(c.endsWith("\r\n"));
});
