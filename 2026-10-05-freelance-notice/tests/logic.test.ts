import { describe, it, expect } from "vitest";
import { paymentDeadline, checkPaymentDate, validateNotice, emptyInput, renderNotice, addDays } from "../src/logic";

const full = () => ({
  ...emptyInput(), clientName: "A社", freelancerName: "山田太郎", contractDate: "2026-10-01",
  workDescription: "ロゴ制作", deliveryDate: "2026-10-20", deliveryPlace: "メール納品", fee: "100,000円",
  paymentDate: "2026-11-30",
});

describe("paymentDeadline", () => {
  it("受領日+59日（初日算入）", () => expect(paymentDeadline("2026-10-01")).toBe("2026-11-29"));
  it("年またぎ", () => expect(paymentDeadline("2026-12-15")).toBe("2027-02-12"));
  it("不正日付はnull", () => expect(paymentDeadline("2026-02-30")).toBeNull());
});
describe("checkPaymentDate", () => {
  it("上限当日はOK", () => expect(checkPaymentDate("2026-10-01", "2026-11-29").ok).toBe(true));
  it("1日超過はNG", () => expect(checkPaymentDate("2026-10-01", "2026-11-30").ok).toBe(false));
  it("受領日より前はNG", () => expect(checkPaymentDate("2026-10-01", "2026-09-30").ok).toBe(false));
});
describe("validateNotice", () => {
  it("空は多数の指摘", () => expect(validateNotice(emptyInput()).length).toBeGreaterThanOrEqual(8));
  it("完全入力は指摘なし", () => expect(validateNotice(full())).toEqual([]));
  it("検収ありで検査日必須", () => {
    const r = validateNotice({ ...full(), inspection: true });
    expect(r.some((x) => x.field === "inspectionDate")).toBe(true);
  });
  it("納期が委託日より前", () => {
    expect(validateNotice({ ...full(), deliveryDate: "2026-09-01" }).some((x) => x.field === "deliveryDate")).toBe(true);
  });
  it("空白のみは未記入扱い", () => {
    expect(validateNotice({ ...full(), clientName: "  " }).some((x) => x.field === "clientName")).toBe(true);
  });
});
describe("validateNotice 日付整合", () => {
  it("前払い(支払期日<納期)は指摘しない", () => {
    expect(validateNotice({ ...full(), paymentDate: "2026-10-10" })).toEqual([]);
  });
  it("検査完了日が納期より前は指摘", () => {
    const r = validateNotice({ ...full(), inspection: true, inspectionDate: "2026-10-05" });
    expect(r.some((x) => x.field === "inspectionDate")).toBe(true);
  });
});
describe("renderNotice", () => {
  it("項目を含む", () => {
    const t = renderNotice(full());
    expect(t).toContain("2026年10月1日");
    expect(t).toContain("ロゴ制作");
    expect(t).not.toContain("検査完了日");
  });
  it("検収あり番号が連続", () => {
    const t = renderNotice({ ...full(), inspection: true, inspectionDate: "2026-10-25" });
    expect(t).toContain("8. 報酬の額");
  });
});
describe("addDays", () => { it("月末跨ぎ", () => expect(addDays("2026-01-31", 1)).toBe("2026-02-01")); });
