import { describe, expect, it } from 'vitest';
import { MAX_YEN, compare, exemptPurchaseDeductionRate, weightedExemptDeductionRate, type Input } from '../src/calc';

const base: Input = {
  salesStd: 5_000_000,
  salesReduced: 0,
  purchasesStd: 1_000_000,
  purchasesReduced: 0,
  exemptPurchasesStd: 0,
  exemptPurchasesReduced: 0,
  exemptDeductionRate: 0.8,
  businessType: 5,
  taxpayer: 'individual',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
  registeredFromExempt: true,
  baseSales: 4_000_000,
};
const get = (i: Input, id: string) => compare(i).results.find((r) => r.id === id)!;

describe('exemptPurchaseDeductionRate', () => {
  it.each([
    ['2023-09-30', 1],
    ['2023-10-01', 0.8],
    ['2026-09-30', 0.8],
    ['2026-10-01', 0.7],
    ['2028-09-30', 0.7],
    ['2028-10-01', 0.5],
    ['2030-09-30', 0.5],
    ['2030-10-01', 0.3],
    ['2031-09-30', 0.3],
    ['2031-10-01', 0],
  ])('%s -> %s', (d, r) => expect(exemptPurchaseDeductionRate(d)).toBe(r));
  it('rejects bad date', () => expect(() => exemptPurchaseDeductionRate('2026/10/01')).toThrow());
});

describe('compare', () => {
  it('computes each method', () => {
    const c = compare(base);
    expect(c.salesTax).toBe(500_000);
    expect(get(base, 'standard').tax).toBe(400_000);
    expect(get(base, 'simplified').tax).toBe(250_000);
    expect(get(base, 'twenty').tax).toBe(100_000);
    expect(get(base, 'twenty').eligible).toBe(true);
    expect(get(base, 'thirty').eligible).toBe(false);
    expect(c.cheapestId).toBe('twenty');
  });
  it('applies exempt-purchase deduction rate', () => {
    const i = { ...base, purchasesStd: 0, exemptPurchasesStd: 1_000_000, exemptDeductionRate: 0.7 };
    expect(get(i, 'standard').tax).toBe(500_000 - 70_000);
  });
  it('2割特例 ends for periods starting 2026-10-01', () => {
    const i = { ...base, taxpayer: 'corporation' as const, periodStart: '2026-10-01', periodEnd: '2027-09-30' };
    expect(get(i, 'twenty').eligible).toBe(false);
  });
  it('2割特例 allowed for straddling corporate period', () => {
    const i = { ...base, taxpayer: 'corporation' as const, periodStart: '2026-04-01', periodEnd: '2027-03-31' };
    expect(get(i, 'twenty').eligible).toBe(true);
  });
  it('3割特例 for individuals in 2027', () => {
    const i = { ...base, periodStart: '2027-01-01', periodEnd: '2027-12-31' };
    expect(get(i, 'thirty').eligible).toBe(true);
    expect(get(i, 'thirty').tax).toBe(150_000);
    expect(get(i, 'twenty').eligible).toBe(false);
  });
  it('3割特例 not for corporations or 2029', () => {
    const corp = { ...base, taxpayer: 'corporation' as const, periodStart: '2027-01-01', periodEnd: '2027-12-31' };
    expect(get(corp, 'thirty').eligible).toBe(false);
    const y29 = { ...base, periodStart: '2029-01-01', periodEnd: '2029-12-31' };
    expect(get(y29, 'thirty').eligible).toBe(false);
  });
  it('簡易課税 unavailable above 50M base sales; 2割 above 10M', () => {
    const i = { ...base, baseSales: 60_000_000 };
    expect(get(i, 'simplified').eligible).toBe(false);
    expect(get(i, 'twenty').eligible).toBe(false);
    const j = { ...base, baseSales: 20_000_000 };
    expect(get(j, 'twenty').eligible).toBe(false);
    expect(get(j, 'simplified').eligible).toBe(true);
  });
  it('rejects reversed period and never marks special methods eligible', () => {
    const i = { ...base, periodStart: '2026-12-31', periodEnd: '2026-01-01' };
    const c = compare(i);
    expect(c.warnings.length).toBe(1);
    expect(get(i, 'twenty').eligible).toBe(false);
  });
  it('is robust to NaN / negative inputs', () => {
    const i = { ...base, salesStd: NaN, purchasesStd: -5 };
    expect(compare(i).salesTax).toBe(0);
  });
  it('reduced-rate sales use 8%', () => {
    const i = { ...base, salesStd: 0, salesReduced: 1_000_000 };
    expect(compare(i).salesTax).toBe(80_000);
  });
});

describe('weightedExemptDeductionRate', () => {
  it('single-rate periods', () => {
    expect(weightedExemptDeductionRate('2025-01-01', '2025-12-31')).toBeCloseTo(0.8);
    expect(weightedExemptDeductionRate('2027-01-01', '2027-12-31')).toBeCloseTo(0.7);
  });
  it('blends across the 2026-10-01 switch', () => {
    // 273日(80%) + 92日(70%) / 365日
    expect(weightedExemptDeductionRate('2026-01-01', '2026-12-31')).toBeCloseTo((273 * 0.8 + 92 * 0.7) / 365, 6);
  });
  it('invalid input returns 0', () => {
    expect(weightedExemptDeductionRate('', '2026-12-31')).toBe(0);
    expect(weightedExemptDeductionRate('2026-12-31', '2026-01-01')).toBe(0);
  });
});

describe('input cap', () => {
  it('clamps absurd values', () => {
    expect(compare({ ...base, salesStd: 1e30 }).salesTax).toBe(Math.floor(MAX_YEN * 0.1));
  });
});
