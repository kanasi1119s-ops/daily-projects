import test from "node:test";
import assert from "node:assert/strict";
import { calcInvoice, checkCorporateNumberDigit, checkRegistrationFormat, validateInvoice } from "../src/logic.js";

test("登録番号形式", () => {
  assert.ok(checkRegistrationFormat("T7000012050002"));
  assert.ok(!checkRegistrationFormat("7000012050002"));
  assert.ok(!checkRegistrationFormat("T123"));
  assert.ok(!checkRegistrationFormat(undefined));
});

test("法人番号チェックデジット（国税庁 7000012050002）", () => {
  assert.ok(checkCorporateNumberDigit("7000012050002"));
  assert.ok(!checkCorporateNumberDigit("7000012050003"));
  assert.ok(!checkCorporateNumberDigit("abc"));
});

test("税率ごと合計後に1回端数処理", () => {
  const items = [
    { name: "a", qty: 1, unitPrice: 99, rate: 10 },
    { name: "b", qty: 1, unitPrice: 99, rate: 10 },
    { name: "c", qty: 3, unitPrice: 101, rate: 8 },
  ];
  const r = calcInvoice(items, "floor");
  assert.equal(r.byRate[10].subtotal, 198);
  assert.equal(r.byRate[10].tax, 19); // 19.8 -> 19（品目ごとなら18）
  assert.equal(r.byRate[8].subtotal, 303);
  assert.equal(r.byRate[8].tax, 24); // 24.24
  assert.equal(r.total, 198 + 19 + 303 + 24);
});

test("端数処理の切替", () => {
  const items = [{ name: "a", qty: 1, unitPrice: 105, rate: 10 }];
  assert.equal(calcInvoice(items, "floor").byRate[10].tax, 10);
  assert.equal(calcInvoice(items, "round").byRate[10].tax, 11);
  assert.equal(calcInvoice(items, "ceil").byRate[10].tax, 11);
});

test("不正入力でNaNを出さない", () => {
  const r = calcInvoice([{ name: "x", qty: "abc", unitPrice: 10, rate: 10 }]);
  assert.equal(r.total, 0);
});

test("検証: 空は必須エラー", () => {
  const r = validateInvoice({ items: [] });
  assert.ok(r.filter((x) => x.level === "error").length >= 4);
});

test("検証: 正常", () => {
  const r = validateInvoice({
    issuerName: "株式会社テスト", registrationNumber: "T7000012050002", date: "2026-10-02",
    recipientName: "御中", items: [{ name: "a", qty: 1, unitPrice: 100, rate: 10 }],
  });
  assert.equal(r.filter((x) => x.level === "error").length, 0);
});

test("浮動小数点の誤差で税額がずれない", () => {
  for (const price of [100, 1000, 58, 290, 1980]) {
    const r = calcInvoice([{ name: "a", qty: 1, unitPrice: price, rate: 10 }], "floor");
    assert.equal(r.byRate[10].tax, Math.floor(price / 10));
  }
});
