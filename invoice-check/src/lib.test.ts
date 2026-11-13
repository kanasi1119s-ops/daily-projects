import { describe, it, expect } from "vitest";
import { calcInvoice, checkTNumber, divRound, isValidCorporateNumber, normalizeT, transitionalRate } from "./lib";

// 国税庁の例示に基づき、アルゴリズムから生成した有効な法人番号を使用
function makeCorp(body12: string): string {
  let sum = 0;
  for (let n = 1; n <= 12; n++) sum += Number(body12[12 - n]) * (n % 2 === 1 ? 1 : 2);
  return String(9 - (sum % 9)) + body12;
}

describe("divRound", () => {
  it("floor/round/ceil", () => {
    expect(divRound(105, 100, "floor")).toBe(1);
    expect(divRound(150, 100, "round")).toBe(2);
    expect(divRound(149, 100, "round")).toBe(1);
    expect(divRound(101, 100, "ceil")).toBe(2);
    expect(divRound(100, 100, "ceil")).toBe(1);
  });
  it("0 and invalid", () => {
    expect(divRound(0, 100, "ceil")).toBe(0);
    expect(() => divRound(1.5, 100, "floor")).toThrow();
  });
});

describe("calcInvoice", () => {
  it("税抜: 税率ごとに1回端数処理", () => {
    const lines = [
      { amount: 333, rate: 10 as const },
      { amount: 333, rate: 10 as const },
      { amount: 105, rate: 8 as const },
    ];
    const r = calcInvoice(lines, false, "floor");
    expect(r.byRate[0].tax).toBe(66); // 666*10% =66.6
    expect(r.byRate[1].tax).toBe(8); // 8.4
    expect(r.totalIncl).toBe(666 + 66 + 105 + 8);
  });
  it("税込", () => {
    const r = calcInvoice([{ amount: 1100, rate: 10 }], true, "floor");
    expect(r.byRate[0].tax).toBe(100);
    expect(r.totalExcl).toBe(1000);
  });
  it("切上/四捨五入の差", () => {
    const l = [{ amount: 15, rate: 10 as const }];
    expect(calcInvoice(l, false, "floor").totalTax).toBe(1);
    expect(calcInvoice(l, false, "round").totalTax).toBe(2);
    expect(calcInvoice([{ amount: 11, rate: 10 }], false, "ceil").totalTax).toBe(2);
  });
  it("空・小数拒否", () => {
    expect(calcInvoice([], false, "floor").totalIncl).toBe(0);
    expect(() => calcInvoice([{ amount: 1.5, rate: 10 }], false, "floor")).toThrow();
    expect(() => calcInvoice([{ amount: 1e15, rate: 10 }], false, "floor")).toThrow();
  });
  it("負数(値引き)は絶対値で端数処理", () => {
    expect(calcInvoice([{ amount: -15, rate: 10 }], false, "round").totalTax).toBe(-2);
  });
});

describe("T番号", () => {
  const corp = makeCorp("700110005901"); // 12桁
  it("有効な法人番号", () => {
    expect(isValidCorporateNumber(corp)).toBe(true);
    expect(checkTNumber("T" + corp).ok).toBe(true);
  });
  it("全角・ハイフン正規化", () => {
    expect(normalizeT("Ｔ-" + corp)).toBe("T" + corp);
    expect(checkTNumber("ｔ " + corp).ok).toBe(true);
  });
  it("誤り検出", () => {
    const bad = String((Number(corp[0]) + 1) % 10) + corp.slice(1);
    expect(checkTNumber("T" + bad).ok).toBe(false);
    expect(checkTNumber("T123").ok).toBe(false);
    expect(checkTNumber("").ok).toBe(false);
    expect(checkTNumber("1234567890123").ok).toBe(false);
  });
});

describe("経過措置", () => {
  it("期間", () => {
    expect(transitionalRate("2024-01-01")).toBe(80);
    expect(transitionalRate("2026-09-30")).toBe(80);
    expect(transitionalRate("2026-10-01")).toBe(50);
    expect(transitionalRate("2029-10-01")).toBe(0);
    expect(transitionalRate("bad")).toBeNull();
    expect(transitionalRate("2026-02-31")).toBeNull();
  });
});
