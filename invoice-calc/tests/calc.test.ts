import { describe, expect, it } from 'vitest';
import { calculate, parseAmount, reverseFromPayable, withholdingTax, type Options } from '../src/calc';

const base: Options = { rounding: 'floor', taxIncludedInput: false, withholding: false, withholdingBase: 'excl' };

describe('withholdingTax', () => {
  it('100万円以下は10.21%', () => {
    expect(withholdingTax(100_000)).toBe(10_210);
    expect(withholdingTax(1_000_000)).toBe(102_100);
  });
  it('100万円超は超過分20.42%を加算', () => {
    expect(withholdingTax(2_000_000)).toBe(306_300);
    expect(withholdingTax(1_000_001)).toBe(102_100);
  });
  it('1円未満切り捨て', () => {
    expect(withholdingTax(12_345)).toBe(1_260);
  });
  it('0以下・不正値は0', () => {
    expect(withholdingTax(0)).toBe(0);
    expect(withholdingTax(-5)).toBe(0);
    expect(withholdingTax(NaN)).toBe(0);
  });
});

describe('calculate', () => {
  it('10%税抜', () => {
    const r = calculate([{ amount: 100_000, rate: 10 }], base);
    expect(r.taxTotal).toBe(10_000);
    expect(r.totalIncl).toBe(110_000);
    expect(r.payable).toBe(110_000);
  });
  it('税率ごとに1回だけ端数処理', () => {
    const r = calculate([{ amount: 333, rate: 10 }, { amount: 333, rate: 10 }], base);
    expect(r.taxTotal).toBe(66); // 666*0.1=66.6 → 66 (個別なら 33+33=66 / 四捨五入なら67 vs 66)
    const r2 = calculate([{ amount: 15, rate: 10 }, { amount: 15, rate: 10 }], { ...base, rounding: 'round' });
    expect(r2.taxTotal).toBe(3); // 合計30*0.1=3 (個別四捨五入だと 2)
  });
  it('8%と10%の混在', () => {
    const r = calculate([{ amount: 1000, rate: 10 }, { amount: 1000, rate: 8 }], base);
    expect(r.breakdown.map((b) => b.tax)).toEqual([100, 80]);
    expect(r.totalIncl).toBe(2180);
  });
  it('税込入力', () => {
    const r = calculate([{ amount: 110_000, rate: 10 }], { ...base, taxIncludedInput: true });
    expect(r.subtotalExcl).toBe(100_000);
    expect(r.taxTotal).toBe(10_000);
  });
  it('源泉徴収: 税抜基準と税込基準', () => {
    const items = [{ amount: 100_000, rate: 10 as const }];
    expect(calculate(items, { ...base, withholding: true }).withholding).toBe(10_210);
    expect(calculate(items, { ...base, withholding: true }).payable).toBe(99_790);
    expect(calculate(items, { ...base, withholding: true, withholdingBase: 'incl' }).withholding).toBe(11_231);
  });
  it('空・0円・負数・NaNは無視', () => {
    const r = calculate([{ amount: 0, rate: 10 }, { amount: -5, rate: 10 }, { amount: NaN, rate: 8 }], base);
    expect(r.totalIncl).toBe(0);
    expect(r.breakdown).toEqual([]);
  });
  it('非課税0%', () => {
    const r = calculate([{ amount: 5000, rate: 0 }], base);
    expect(r.taxTotal).toBe(0);
    expect(r.totalIncl).toBe(5000);
  });
});

describe('reverseFromPayable', () => {
  const o = { rounding: 'floor' as const, withholding: true, withholdingBase: 'excl' as const };
  it('逆算結果を順計算すると目標以上になり、1円少ないと目標未満', () => {
    for (const t of [10_000, 99_790, 123_456, 1_000_000, 3_333_333]) {
      const r = reverseFromPayable(t, o)!;
      const f = (x: number) => calculate([{ amount: x, rate: 10 }], { ...o, taxIncludedInput: false }).payable;
      expect(f(r.excl)).toBeGreaterThanOrEqual(t);
      expect(f(r.excl - 1)).toBeLessThan(t);
    }
  });
  it('99,790円 → 100,000円', () => {
    expect(reverseFromPayable(99_790, o)).toEqual({ excl: 100_000, payable: 99_790, exact: true });
  });
  it('不正入力はnull', () => {
    expect(reverseFromPayable(0, o)).toBeNull();
    expect(reverseFromPayable(NaN, o)).toBeNull();
  });
});

describe('parseAmount', () => {
  it('全角・カンマ・円記号を許容', () => {
    expect(parseAmount('１２，３４５円')).toBe(12345);
    expect(parseAmount('¥ 1,000')).toBe(1000);
  });
  it('不正値はNaN', () => {
    for (const s of ['abc', '-5', '1.5', '１２３４５６７８９０１２３']) expect(parseAmount(s)).toBeNaN();
  });
});
