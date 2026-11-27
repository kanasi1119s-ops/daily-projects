import test from "node:test";
import assert from "node:assert/strict";
import { latestPaymentDate, checkPaymentDate, missingItems, buildOrderSheet, diagnose, DIAGNOSIS_QUESTIONS } from "../lib/logic.js";

test("60日ルール上限", () => {
  assert.equal(latestPaymentDate("2026-11-01"), "2026-12-30");
  assert.equal(latestPaymentDate("2026-12-15"), "2027-02-12");
  assert.equal(latestPaymentDate("bad"), null);
  assert.equal(latestPaymentDate("2026-02-30"), null);
});
test("支払期日判定", () => {
  assert.equal(checkPaymentDate("2026-11-01", "2026-12-30").ok, true);
  assert.equal(checkPaymentDate("2026-11-01", "2026-12-31").ok, false);
  assert.equal(checkPaymentDate("", "2026-12-31").ok, false);
});
test("不足項目", () => {
  assert.equal(missingItems({}).length, 8);
  assert.ok(missingItems({ inspection: "yes" }).includes("検査完了日"));
  assert.ok(missingItems({ nonCash: "yes" }).includes("報酬の支払方法(現金以外)"));
});
test("発注書生成", () => {
  const r = buildOrderSheet({ clientName: "A社" });
  assert.match(r.text, /A社/); assert.match(r.text, /未記入/); assert.ok(r.missing.length > 0);
});
test("診断", () => {
  assert.equal(diagnose({}).level, "未回答あり");
  const all = Object.fromEntries(DIAGNOSIS_QUESTIONS.map(q => [q.id, q.good]));
  assert.equal(diagnose(all).level, "指摘なし");
  assert.equal(diagnose({ ...all, cut: true }).issues[0].id, "cut");
});
test("発注書の支払期日警告", () => {
  assert.equal(buildOrderSheet({ deliveryDate: "2026-11-01", paymentDate: "2027-01-31" }).warnings.length, 1);
  assert.equal(buildOrderSheet({ deliveryDate: "2026-11-01", paymentDate: "2026-11-30" }).warnings.length, 0);
});
