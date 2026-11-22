import test from "node:test";
import assert from "node:assert/strict";
import { validateRegistrationNumber, calcTax, summarize, checkInvoice } from "../src/core.js";

test("登録番号: 国税庁の例(T7000012050002 = 国税庁法人番号)", () => {
  assert.equal(validateRegistrationNumber("T7000012050002").ok, true);
});
test("登録番号: 形式・チェックデジット不正", () => {
  assert.equal(validateRegistrationNumber("1234567890123").ok, false);
  assert.equal(validateRegistrationNumber("T7000012050003").ok, false);
  assert.equal(validateRegistrationNumber("").ok, false);
});
test("登録番号: 全角を正規化", () => {
  assert.equal(validateRegistrationNumber("Ｔ７０００　０１２０５０００２".replace("　", "")).ok, true);
});
test("税額: 端数処理", () => {
  assert.equal(calcTax(1001, 10, "floor"), 100);
  assert.equal(calcTax(1005, 10, "round"), 101);
  assert.equal(calcTax(1001, 10, "ceil"), 101);
});
test("集計: 税率ごとに1回だけ端数処理", () => {
  const s = summarize([{ qty: 1, unitPrice: 105, rate: 10 }, { qty: 1, unitPrice: 105, rate: 10 }]);
  assert.equal(s.rows[0].tax, 21); // 行ごと切捨(10+10=20)ではなく合計210の10%
});
test("集計: 税込入力", () => {
  const s = summarize([{ qty: 1, unitPrice: 1100, rate: 10 }], { taxIncluded: true });
  assert.deepEqual(s.rows[0], { rate: 10, exTax: 1000, tax: 100, inTax: 1100 });
});
const base = () => ({
  kind: "standard", issuerName: "株式会社テスト", regNo: "T7000012050002", date: "2026-11-01",
  recipientName: "株式会社相手", taxIncluded: false, rounding: "floor",
  items: [{ desc: "A", qty: 1, unitPrice: 1000, rate: 10 }], statedTax: { 10: 100 },
});
test("請求書: 正常系", () => assert.equal(checkInvoice(base()).pass, true));
test("請求書: 税額不一致を検出", () => {
  const i = base(); i.statedTax = { 10: 90 };
  const r = checkInvoice(i); assert.equal(r.pass, false);
  assert.match(r.results.find(x => x.id === "tax").message, /不一致/);
});
test("請求書: 軽減税率の※漏れ", () => {
  const i = base(); i.items.push({ desc: "食品", qty: 1, unitPrice: 100, rate: 8, reduced: false }); i.statedTax[8] = 8;
  assert.equal(checkInvoice(i).results.find(x => x.id === "reduced").status, "ng");
});
test("請求書: 簡易請求書は交付先不要", () => {
  const i = base(); i.kind = "simplified"; i.recipientName = "";
  assert.equal(checkInvoice(i).results.some(x => x.id === "recipient"), false);
});
test("請求書: 必須欄の未入力", () => {
  const r = checkInvoice({ kind: "standard", items: [], statedTax: {} });
  assert.ok(r.ng >= 5);
});
test("請求書: 単価未入力の明細を検出", () => {
  const i = base(); i.items.push({ desc: "B", qty: 1, unitPrice: null, rate: 10 });
  assert.equal(checkInvoice(i).results.find(x => x.id === "numbers").status, "ng");
});
test("請求書: 簡易請求書は税額未入力でも税率区分で可", () => {
  const i = base(); i.kind = "simplified"; i.statedTax = {};
  const r = checkInvoice(i); assert.equal(r.pass, true); assert.equal(r.warn, 0);
});
test("税額: BigInt基準との一致(乱数1万件)", () => {
  for (let i = 0; i < 10000; i++) {
    const a = Math.floor(Math.random() * 1e9), r = i % 2 ? 8 : 10;
    assert.equal(calcTax(a, r, "floor"), Number(BigInt(a) * BigInt(r) / 100n));
    assert.equal(summarize([{ qty: 1, unitPrice: a, rate: r }], { taxIncluded: true }).rows[0].tax, Number(BigInt(a) * BigInt(r) / BigInt(100 + r)));
  }
});
