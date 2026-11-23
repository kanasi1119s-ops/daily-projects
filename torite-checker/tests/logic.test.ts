import { describe, it, expect } from "vitest";
import { parseDate, fmt, latestPaymentDate, checkPayment, closingWorstCase, judgeApplicability } from "../src/logic";
const d = (s: string) => parseDate(s)!;
describe("dates", () => {
  it("rejects invalid", () => { expect(parseDate("2026-02-30")).toBeNull(); expect(parseDate("abc")).toBeNull(); });
  it("60th day inclusive", () => { expect(fmt(latestPaymentDate(d("2026-01-01")))).toBe("2026-03-01"); });
});
describe("checkPayment", () => {
  it("ok within 60", () => { const r = checkPayment(d("2026-01-01"), d("2026-03-01"), 100000); expect(r.ok).toBe(true); expect(r.interest).toBe(0); });
  it("late 10 days", () => { const r = checkPayment(d("2026-01-01"), d("2026-03-11"), 365000); expect(r.ok).toBe(false); expect(r.overdueDays).toBe(10); expect(r.interest).toBe(1460); });
  it("bad amount", () => { expect(checkPayment(d("2026-01-01"), d("2026-04-01"), NaN).interest).toBe(0); });
});
describe("closing", () => {
  it("末締め翌月末払い exceeds 60 in some months", () => { const r = closingWorstCase(0, 1, 0, 2026); expect(r.maxDays).toBe(62); expect(r.ok).toBe(false); });
  it("末締め翌月15日払い ok", () => { expect(closingWorstCase(0, 1, 15, 2026).ok).toBe(true); });
  it("25日締め翌月末", () => { expect(closingWorstCase(25, 1, 0, 2026).maxDays).toBeGreaterThan(50); });
});
describe("applicability", () => {
  const base = { type: "B" as const, clientCapitalMan: 10000, clientEmployees: 10, contractorIndividual: true, contractorCapitalMan: 0, contractorEmployees: 0 };
  it("capital B", () => { const r = judgeApplicability(base); expect(r.torite).toBe(true); expect(r.freelance).toBe(true); });
  it("small client", () => { expect(judgeApplicability({ ...base, clientCapitalMan: 500 }).torite).toBe(false); });
  it("employee criterion", () => { expect(judgeApplicability({ ...base, clientCapitalMan: 500, clientEmployees: 150 }).torite).toBe(true); });
  it("individual with employees not freelance", () => { expect(judgeApplicability({ ...base, contractorEmployees: 2 }).freelance).toBe(false); });
  it("contractor with employees not freelance", () => { expect(judgeApplicability({ ...base, contractorIndividual: false, contractorCapitalMan: 300, contractorEmployees: 3 }).freelance).toBe(false); });
});
