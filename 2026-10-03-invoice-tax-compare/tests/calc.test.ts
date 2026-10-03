import { describe, expect, it } from "vitest";
import { calculate, cheapest, type Input } from "../src/calc";

const base: Input = {
  year: 2027,
  sales: 5_500_000,
  purchasesQualified: 1_100_000,
  purchasesUnqualified: 0,
  businessType: 5,
  baseSales: 3_000_000,
  wasExempt: true,
};
const get = (i: Input, id: string) => calculate(i).find((r) => r.id === id)!;

describe("calculate", () => {
  it("原則課税: 売上税額-仕入税額", () => {
    expect(get(base, "general").tax).toBe(500_000 - 100_000);
  });
  it("簡易課税 第5種: 売上税額×50%", () => {
    expect(get(base, "simplified").tax).toBe(250_000);
  });
  it("3割特例(2027): 売上税額×30%", () => {
    const r = get(base, "special30");
    expect(r.available).toBe(true);
    expect(r.tax).toBe(150_000);
    expect(get(base, "special20").available).toBe(false);
  });
  it("2割特例(2026)のみ有効", () => {
    const i = { ...base, year: 2026 as const };
    expect(get(i, "special20").tax).toBe(100_000);
    expect(get(i, "special20").available).toBe(true);
    expect(get(i, "special30").available).toBe(false);
  });
  it("免税事業者だった場合のみ特例が使える", () => {
    expect(get({ ...base, wasExempt: false }, "special30").available).toBe(false);
  });
  it("基準期間1,000万円超は特例不可、5,000万円超は簡易課税も不可", () => {
    expect(get({ ...base, baseSales: 10_000_001 }, "special30").available).toBe(false);
    expect(get({ ...base, baseSales: 50_000_001 }, "simplified").available).toBe(false);
  });
  it("免税事業者仕入の経過措置: 2027年は70%控除", () => {
    const i = { ...base, purchasesQualified: 0, purchasesUnqualified: 1_100_000 };
    expect(get(i, "general").tax).toBe(500_000 - 70_000);
  });
  it("経過措置の年度加重（2026=77.5%, 2028=65%）", () => {
    const u = { ...base, purchasesQualified: 0, purchasesUnqualified: 1_100_000 };
    expect(get({ ...u, year: 2026 }, "general").tax).toBe(500_000 - 77_500);
    expect(get({ ...u, year: 2028 }, "general").tax).toBe(500_000 - 65_000);
  });
  it("仕入が売上を上回ると原則課税は還付(負値)", () => {
    expect(get({ ...base, purchasesQualified: 8_800_000 }, "general").tax).toBeLessThan(0);
  });
  it("不正値(負・NaN)は0扱い", () => {
    const r = calculate({ ...base, sales: -5, purchasesQualified: NaN });
    expect(r.every((x) => Number.isFinite(x.tax))).toBe(true);
  });
  it("cheapest は利用可能な方式から最小を返す", () => {
    expect(cheapest(calculate(base))!.id).toBe("special30");
    expect(cheapest(calculate({ ...base, wasExempt: false }))!.id).toBe("simplified");
  });
  it("浮動小数点誤差の回帰: 売上税額90円×70%=63円", () => {
    const i = { ...base, sales: 990, purchasesQualified: 0, businessType: 3 as const };
    expect(get(i, "simplified").tax).toBe(90 - 63);
  });
  it("境界値: 基準期間 1,000万円/5,000万円ちょうどは対象", () => {
    expect(get({ ...base, baseSales: 10_000_000 }, "special30").available).toBe(true);
    expect(get({ ...base, baseSales: 50_000_000 }, "simplified").available).toBe(true);
  });
});
