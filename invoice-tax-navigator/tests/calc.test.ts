import { describe, it, expect } from "vitest";
import { calculate, daysUntil, validate, Input } from "../src/calc";

const base: Input = { sales: 8_000_000, purchases: 1_000_000, baseSales: 7_000_000, bizType: 5, isIndividual: true, wasExempt: true };

describe("calculate", () => {
  it("3方式の税額", () => {
    const r = calculate(base);
    const t = Object.fromEntries(r.methods.map((m) => [m.id, m.tax]));
    expect(t.standard).toBe(700_000); // 800,000-100,000
    expect(t.simplified).toBe(400_000); // 800,000 - 800,000*50%
    expect(t.thirty).toBe(240_000);
    expect(r.best).toBe("thirty");
  });
  it("3割特例は個人のみ/免税出身のみ/1000万以下", () => {
    expect(calculate({ ...base, isIndividual: false }).methods[2].eligible).toBe(false);
    expect(calculate({ ...base, wasExempt: false }).methods[2].eligible).toBe(false);
    expect(calculate({ ...base, baseSales: 10_000_001 }).methods[2].eligible).toBe(false);
    expect(calculate({ ...base, baseSales: 10_000_000 }).methods[2].eligible).toBe(true);
  });
  it("簡易課税は5000万円超で不可", () => {
    const r = calculate({ ...base, baseSales: 50_000_001 });
    expect(r.methods[1].eligible).toBe(false);
    expect(r.methods[1].tax).toBeNull();
  });
  it("第1種は簡易が最有利、仕入が多いと原則が最有利", () => {
    expect(calculate({ ...base, bizType: 1 }).best).toBe("simplified");
    expect(calculate({ ...base, bizType: 4, purchases: 6_000_000 }).best).toBe("standard");
  });
  it("仕入超過で還付(マイナス)と警告", () => {
    const r = calculate({ ...base, purchases: 9_000_000 });
    expect(r.methods[0].tax).toBe(-100_000);
    expect(r.best).toBe("standard");
    expect(r.warnings.some((w) => w.includes("還付"))).toBe(true);
  });
  it("損益分岐の仕入率", () => {
    expect(calculate({ ...base, bizType: 5 }).breakEvenPurchaseRatio).toBeCloseTo(0.5);
  });
  it("0円入力", () => {
    const r = calculate({ ...base, sales: 0, purchases: 0 });
    expect(r.methods.map((m) => m.tax)).toEqual([0, 0, 0]);
  });
});

describe("validate / daysUntil", () => {
  it("負数・NaN を弾く", () => {
    expect(validate({ ...base, sales: -1 }).length).toBe(1);
    expect(validate({ ...base, purchases: NaN }).length).toBe(1);
    expect(validate(base)).toEqual([]);
  });
  it("残日数", () => {
    expect(daysUntil("2026-12-31", new Date(2026, 10, 18))).toBe(43);
    expect(daysUntil("2026-12-31", new Date(2026, 11, 31))).toBe(0);
    expect(daysUntil("2026-12-31", new Date(2027, 0, 1))).toBe(-1);
  });
});
