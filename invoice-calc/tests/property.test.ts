import { describe, expect, it } from 'vitest';
import { calculate, reverseFromPayable, type Options, type Rounding, type WithholdingBase } from '../src/calc';

describe('逆算の総当たり検証', () => {
  for (const rounding of ['floor', 'round', 'ceil'] as Rounding[])
    for (const withholdingBase of ['excl', 'incl'] as WithholdingBase[])
      it(`${rounding}/${withholdingBase}: 振込額は税抜額に対して単調非減少、逆算は最小解`, () => {
        const o: Options = { rounding, withholdingBase, withholding: true, taxIncludedInput: false };
        const f = (x: number) => calculate([{ amount: x, rate: 10 }], o).payable;
        let prev = 0;
        for (let x = 1; x <= 1_300_000; x += 997) {
          const v = f(x);
          expect(v).toBeGreaterThanOrEqual(prev);
          prev = v;
        }
        for (const t of [1, 2, 9, 1000, 88_888, 912_345, 1_000_000, 1_234_567]) {
          const r = reverseFromPayable(t, o)!;
          expect(f(r.excl)).toBeGreaterThanOrEqual(t);
          expect(r.excl === 1 || f(r.excl - 1) < t).toBe(true);
        }
      });
  it('巨大値でも有限の整数', () => {
    const r = calculate([{ amount: 999_999_999_999, rate: 10 }], { rounding: 'round', taxIncludedInput: true, withholding: true, withholdingBase: 'incl' });
    expect(Number.isSafeInteger(r.payable)).toBe(true);
    expect(reverseFromPayable(1e11, { rounding: 'floor', withholding: true, withholdingBase: 'excl' })).not.toBeNull();
  });
  it('税込入力: 内訳が合計と一致', () => {
    const r = calculate([{ amount: 1080, rate: 8 }, { amount: 1100, rate: 10 }], { rounding: 'floor', taxIncludedInput: true, withholding: false, withholdingBase: 'excl' });
    expect(r.totalIncl).toBe(2180);
    expect(r.subtotalExcl + r.taxTotal).toBe(r.totalIncl);
  });
});
