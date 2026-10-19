import { describe, expect, it } from "vitest";
import { emptyInput, hasError, parseDate, render, validate, type NoticeInput } from "../src/notice";

const ok: NoticeInput = {
  ...emptyInput, clientName: "株式会社A", freelancerName: "山田太郎", orderDate: "2026-10-01",
  description: "LP制作", deliveryDate: "2026-10-31", deliveryPlace: "メール納品",
  amount: "100000", taxMode: "incl" as const, dueDate: "2026-11-30",
};

describe("validate", () => {
  it("passes valid input", () => expect(validate(ok)).toEqual([]));
  it("requires fields", () => expect(hasError(validate(emptyInput))).toBe(true));
  it("rejects invalid date", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(hasError(validate({ ...ok, dueDate: "2026-02-30" }))).toBe(true);
  });
  it("rejects non-numeric / zero amount", () => {
    expect(hasError(validate({ ...ok, amount: "10万" }))).toBe(true);
    expect(hasError(validate({ ...ok, amount: "0" }))).toBe(true);
  });
  it("accepts calculation note instead of amount", () =>
    expect(hasError(validate({ ...ok, amount: "", amountNote: "時給3000円×稼働時間" }))).toBe(false));
  it("requires inspection date when inspection on", () =>
    expect(hasError(validate({ ...ok, hasInspection: true }))).toBe(true));
  it("warns when due date exceeds 60 days", () => {
    const r = validate({ ...ok, dueDate: "2026-12-31" });
    expect(r.some((x) => x.level === "warn" && x.field === "dueDate")).toBe(true);
    expect(hasError(r)).toBe(false);
  });
  it("allows exactly 60 days", () =>
    expect(validate({ ...ok, deliveryDate: "2026-10-01", dueDate: "2026-11-30" })).toEqual([]));
  it("warns for non-cash without detail", () =>
    expect(validate({ ...ok, paymentMethod: "ポイント" }).some((x) => x.field === "nonCashDetail")).toBe(true));
});

describe("render", () => {
  it("includes key items", () => {
    const t = render(ok);
    expect(t).toContain("100,000円");
    expect(t).toContain("2026年11月30日");
    expect(t).toContain("検査: 行わない");
  });
});

describe("round1 fixes", () => {
  it("rejects over 12 digits", () => expect(hasError(validate({ ...ok, amount: "1234567890123" }))).toBe(true));
  it("renders tax mode", () => expect(render({ ...ok, taxMode: "excl" })).toContain("(税別)"));
  it("warns inspection before delivery", () =>
    expect(validate({ ...ok, hasInspection: true, inspectionDate: "2026-10-15" }).some((x) => x.field === "inspectionDate")).toBe(true));
});
