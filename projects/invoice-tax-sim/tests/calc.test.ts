import { describe, it, expect } from "vitest";
import { simulate, best, buyerDeductionRatio, buyerBurden, specialRatio } from "../src/calc";

const base = { sales: 5_000_000, purchasesInclTax: 1_100_000, business: 5 as const, year: 2026 };

describe("simulate", () => {
  it("本則・簡易・2割特例を計算する", () => {
    const o = Object.fromEntries(simulate(base).map((x) => [x.key, x.tax]));
    expect(o.honsoku).toBe(500_000 - 100_000);
    expect(o.kani).toBe(250_000);
    expect(o.special).toBe(100_000);
    expect(o.exempt).toBe(0);
  });
  it("2027年は3割特例", () => {
    expect(simulate({ ...base, year: 2027 }).find((x) => x.key === "special")!.tax).toBe(150_000);
  });
  it("特例の対象外年は特例なし", () => {
    expect(simulate({ ...base, year: 2029 }).some((x) => x.key === "special")).toBe(false);
    expect(specialRatio(2025)).toBeNull();
  });
  it("免税を除いた最安を選ぶ前提: best は available のみ", () => {
    const o = simulate({ ...base, sales: 60_000_000 });
    expect(o.find((x) => x.key === "kani")!.available).toBe(false);
    expect(best(o).key).not.toBe("kani");
  });
  it("仕入が大きいと本則が還付(負値)になる", () => {
    const o = simulate({ ...base, purchasesInclTax: 11_000_000 });
    expect(o.find((x) => x.key === "honsoku")!.tax).toBeLessThan(0);
  });
  it("売上1,000万円超は特例・免税が使えない", () => {
    const o = simulate({ ...base, sales: 20_000_000 });
    expect(o.find((x) => x.key === "special")!.available).toBe(false);
    expect(o.find((x) => x.key === "exempt")!.available).toBe(false);
    expect(best(o).key).toBe("kani");
  });
  it("best は免税を選ばない", () => {
    expect(best(simulate(base)).key).toBe("special");
  });
  it("負数・小数を安全に扱う", () => {
    const o = simulate({ ...base, sales: -5, purchasesInclTax: 0.9 });
    expect(o.every((x) => Number.isFinite(x.tax))).toBe(true);
  });
});

describe("buyer deduction", () => {
  it("段階的に下がる", () => {
    expect(buyerDeductionRatio(2023, 9)).toBe(1);
    expect(buyerDeductionRatio(2026, 9)).toBe(0.8);
    expect(buyerDeductionRatio(2026, 10)).toBe(0.7);
    expect(buyerDeductionRatio(2028, 10)).toBe(0.5);
    expect(buyerDeductionRatio(2031, 10)).toBe(0);
  });
  it("負担額", () => {
    expect(buyerBurden(1_100_000, 2026, 10)).toBe(30_000);
  });
});
