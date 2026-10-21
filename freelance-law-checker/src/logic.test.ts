import { describe, expect, it } from "vitest";
import { checkPayment, periodEnd, parseDate, renderTerms, missingFields, type Terms } from "./logic";

const ind = (r: string, d: string) => checkPayment({ receivedDate: r, dueDate: d, mode: "individual", closingDay: 31 });

describe("checkPayment", () => {
  it("受領日を1日目として60日目はOK、61日目はNG", () => {
    const a = ind("2026-01-01", "2026-03-01");
    expect(a).toMatchObject({ ok: true, daysUsed: 60, limitDate: "2026-03-01" });
    const b = ind("2026-01-01", "2026-03-02");
    expect(b).toMatchObject({ ok: false, daysUsed: 61 });
  });
  it("不正入力はエラー", () => {
    expect(ind("", "2026-03-01")).toHaveProperty("error");
    expect(ind("2026-02-30", "2026-03-01")).toHaveProperty("error");
    expect(ind("2026-03-05", "2026-03-01")).toHaveProperty("error");
  });
  it("月末締めは期間末日を起算日にする", () => {
    const r = checkPayment({ receivedDate: "2026-01-05", dueDate: "2026-02-28", mode: "monthly", closingDay: 31 });
    expect(r).toMatchObject({ ok: true, baseDate: "2026-01-31", daysUsed: 29 });
  });
  it("月末締めでも期限超過は検出", () => {
    const r = checkPayment({ receivedDate: "2026-01-05", dueDate: "2026-04-05", mode: "monthly", closingDay: 31 });
    expect(r).toMatchObject({ ok: false });
  });
  it("締め日が不正ならエラー", () => {
    expect(checkPayment({ receivedDate: "2026-01-05", dueDate: "2026-02-28", mode: "monthly", closingDay: 0 })).toHaveProperty("error");
  });
});

describe("periodEnd", () => {
  it("20日締め", () => {
    expect(periodEnd(parseDate("2026-01-21")!, 20).toISOString().slice(0, 10)).toBe("2026-02-20");
    expect(periodEnd(parseDate("2026-01-20")!, 20).toISOString().slice(0, 10)).toBe("2026-01-20");
  });
  it("30日締めは2月は月末に丸める", () => {
    expect(periodEnd(parseDate("2026-02-10")!, 30).toISOString().slice(0, 10)).toBe("2026-02-28");
  });
  it("年またぎ", () => {
    expect(periodEnd(parseDate("2026-12-25")!, 20).toISOString().slice(0, 10)).toBe("2027-01-20");
  });
});

describe("terms", () => {
  const empty: Terms = { clientName: "", freelancerName: "", work: "", fee: "", dueDate: "", deliveryDate: "", deliveryPlace: "", inspectionDate: "", paymentMethod: "" };
  it("必須未入力を検出", () => {
    expect(missingFields(empty)).toHaveLength(7);
    expect(missingFields({ ...empty, clientName: " ", work: "x" })).toContain("clientName");
  });
  it("出力に値が入る", () => {
    expect(renderTerms({ ...empty, work: "LP制作" })).toContain("LP制作");
  });
});

describe("edge", () => {
  it("閏年の2月末締め", () => {
    const r = checkPayment({ receivedDate: "2028-02-10", dueDate: "2028-03-31", mode: "monthly", closingDay: 31 });
    expect(r).toMatchObject({ ok: true, baseDate: "2028-02-29" });
  });
  it("受領日当日払いは1日目", () => {
    expect(ind("2026-05-01", "2026-05-01")).toMatchObject({ ok: true, daysUsed: 1 });
  });
});
