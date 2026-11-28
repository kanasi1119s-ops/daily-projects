/** 請求額計算ロジック(純関数)。参考計算であり税務上の確定額ではない。 */
export type Rounding = 'floor' | 'round' | 'ceil';
export type TaxRate = 10 | 8 | 0;
export type WithholdingBase = 'excl' | 'incl';

export interface Item {
  amount: number; // 円
  rate: TaxRate;
}

export interface Options {
  rounding: Rounding;
  taxIncludedInput: boolean; // 入力金額が税込か(請求書単位で統一)
  withholding: boolean;
  withholdingBase: WithholdingBase; // 税抜(消費税を区分記載) or 税込
}

export interface RateBreakdown {
  rate: TaxRate;
  excl: number;
  tax: number;
  incl: number;
}

export interface Result {
  breakdown: RateBreakdown[];
  subtotalExcl: number;
  taxTotal: number;
  totalIncl: number;
  withholding: number;
  payable: number; // 振込額 = 税込合計 − 源泉徴収
}

export const roundBy = (m: Rounding, v: number): number =>
  m === 'floor' ? Math.floor(v) : m === 'ceil' ? Math.ceil(v) : Math.round(v);

/** 報酬・料金に対する源泉徴収税額(復興特別所得税込み)。1円未満切り捨て。整数演算で誤差を避ける。 */
export function withholdingTax(base: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const b = Math.floor(base);
  if (b <= 1_000_000) return Math.floor((b * 1021) / 10000);
  return Math.floor(((b - 1_000_000) * 2042) / 10000) + 102_100;
}

/** 税率ごとに合計し、請求書1枚につき税率ごとに1回だけ端数処理する。 */
export function calculate(items: Item[], opt: Options): Result {
  const breakdown: RateBreakdown[] = [];
  for (const rate of [10, 8, 0] as TaxRate[]) {
    const list = items.filter((i) => i.rate === rate && Number.isFinite(i.amount) && i.amount > 0);
    if (list.length === 0) continue;
    const sum = list.reduce((s, i) => s + Math.floor(i.amount), 0);
    if (opt.taxIncludedInput) {
      const tax = roundBy(opt.rounding, (sum * rate) / (100 + rate));
      breakdown.push({ rate, excl: sum - tax, tax, incl: sum });
    } else {
      const tax = roundBy(opt.rounding, (sum * rate) / 100);
      breakdown.push({ rate, excl: sum, tax, incl: sum + tax });
    }
  }
  const subtotalExcl = breakdown.reduce((s, b) => s + b.excl, 0);
  const taxTotal = breakdown.reduce((s, b) => s + b.tax, 0);
  const totalIncl = subtotalExcl + taxTotal;
  const wBase = opt.withholdingBase === 'excl' ? subtotalExcl : totalIncl;
  const withholding = opt.withholding ? withholdingTax(wBase) : 0;
  return { breakdown, subtotalExcl, taxTotal, totalIncl, withholding, payable: totalIncl - withholding };
}

export interface ReverseResult {
  excl: number; // 必要な税抜報酬額
  payable: number; // その時の振込額
  exact: boolean; // 目標額ちょうどになるか
}

/** 手取り(振込額)から、10%課税の税抜報酬額を逆算する。ちょうどの額がなければ「以上で最小」を返す。 */
export function reverseFromPayable(
  target: number,
  opt: Pick<Options, 'rounding' | 'withholding' | 'withholdingBase'>,
): ReverseResult | null {
  if (!Number.isFinite(target) || target <= 0 || target > 1e11) return null;
  const full: Options = { ...opt, taxIncludedInput: false };
  const f = (x: number) => calculate([{ amount: x, rate: 10 }], full).payable;
  let lo = 1;
  let hi = Math.ceil(target) + 10;
  while (f(hi) < target) hi *= 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (f(mid) >= target) hi = mid;
    else lo = mid + 1;
  }
  const payable = f(lo);
  return { excl: lo, payable, exact: payable === target };
}

/** 全角数字・カンマ・円記号を許容して整数に変換。不正なら NaN。 */
export function parseAmount(s: string): number {
  const t = s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，¥￥円\s]/g, '');
  if (!/^\d{1,12}$/.test(t)) return NaN;
  return Number(t);
}
