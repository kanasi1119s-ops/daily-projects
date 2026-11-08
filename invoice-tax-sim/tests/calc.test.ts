import { describe, expect, it } from "vitest";
import { calculate, taxPortion, type Input } from "../src/calc";

const base: Input = {
  sales10: 0, sales8: 0, qualPurchase10: 0, qualPurchase8: 0,
  nonQualPurchase10: 0, nonQualPurchase8: 0, transitionRate: 0.8,
  businessType: 5, baseSales: 5_000_000, wasExempt: true, inTwentyPercentPeriod: true,
};
const get = (r: ReturnType<typeof calculate>, k: string) => r.methods.find((m) => m.key === k)!;

describe("taxPortion", () => {
  it("10%/8% を切り捨てで抽出", () => {
    expect(taxPortion(1_100_000, 10)).toBe(100_000);
    expect(taxPortion(108_000, 8)).toBe(8_000);
    expect(taxPortion(1_000, 10)).toBe(90);
  });
  it("不正値は0", () => {
    expect(taxPortion(-5, 10)).toBe(0);
    expect(taxPortion(NaN, 8)).toBe(0);
  });
});

describe("calculate", () => {
  it("3方式の基本計算", () => {
    const r = calculate({ ...base, sales10: 5_500_000, qualPurchase10: 1_100_000 });
    expect(r.outputTax).toBe(500_000);
    expect(get(r, "standard").tax).toBe(400_000);
    expect(get(r, "simplified").tax).toBe(250_000); // 第5種50%
    expect(get(r, "twenty").tax).toBe(100_000);
    expect(r.best).toBe("twenty");
  });
  it("経過措置控除割合を反映", () => {
    const r = calculate({ ...base, sales10: 1_100_000, nonQualPurchase10: 1_100_000, transitionRate: 0.5 });
    expect(r.inputTaxStandard).toBe(50_000);
  });
  it("本則はマイナス(還付)になり得る", () => {
    const r = calculate({ ...base, sales10: 110_000, qualPurchase10: 1_100_000 });
    expect(get(r, "standard").tax).toBe(-90_000);
    expect(r.best).toBe("standard");
  });
  it("基準期間1,000万円超は2割特例不可", () => {
    const r = calculate({ ...base, sales10: 1_100_000, baseSales: 10_000_001 });
    expect(get(r, "twenty").available).toBe(false);
    expect(get(r, "twenty").tax).toBeNull();
  });
  it("基準期間5,000万円超は簡易課税不可", () => {
    const r = calculate({ ...base, sales10: 1_100_000, baseSales: 50_000_001 });
    expect(get(r, "simplified").available).toBe(false);
  });
  it("適用期間外・元課税事業者は2割特例不可", () => {
    expect(get(calculate({ ...base, inTwentyPercentPeriod: false }), "twenty").available).toBe(false);
    expect(get(calculate({ ...base, wasExempt: false }), "twenty").available).toBe(false);
  });
  it("NaN/負数入力でも落ちない", () => {
    const r = calculate({ ...base, sales10: NaN, sales8: -1, transitionRate: NaN });
    expect(r.outputTax).toBe(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("同額の場合は先に評価した方式(本則)を優先", () => {
    const r = calculate({ ...base, wasExempt: false });
    expect(r.best).toBe("standard");
  });
  it("巨大入力は上限で丸めて警告", () => {
    const r = calculate({ ...base, sales10: 1e30 });
    expect(Number.isSafeInteger(r.outputTax)).toBe(true);
    expect(r.warnings.some((w) => w.includes("上限"))).toBe(true);
  });
  it("8%と10%の合算", () => {
    const r = calculate({ ...base, sales10: 1_100_000, sales8: 1_080_000 });
    expect(r.outputTax).toBe(180_000);
  });
  it("経過措置80%/0%", () => {
    const i = { ...base, sales10: 0, nonQualPurchase10: 1_100_000 };
    expect(calculate({ ...i, transitionRate: 0.8 }).inputTaxStandard).toBe(80_000);
    expect(calculate({ ...i, transitionRate: 0 }).inputTaxStandard).toBe(0);
  });
});
