import { RATE_PERIODS, SMALL_AMOUNT } from './rates.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TAX_RATES = [8, 10];
const MAX_AMOUNT = 1e13; // 浮動小数の誤差を避ける上限
const applyRate = (tax, rate) => Math.floor((tax * Math.round(rate * 100)) / 100);

export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 && input <= MAX_AMOUNT ? Math.floor(input) : NaN;
  const s = String(input ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，円\s]/g, '');
  if (!/^\d+$/.test(s)) return NaN;
  const n = Number(s);
  return n <= MAX_AMOUNT ? n : NaN;
}

// 控除割合。制度開始前は 1（全額）、経過措置終了後は 0。
export function getRate(date) {
  if (!date) throw new Error('取引日を入力してください');
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) throw new Error(`日付が不正です: ${date}`);
  if (date < RATE_PERIODS[0].from) return 1;
  const p = RATE_PERIODS.find((r) => date >= r.from && date <= r.to);
  return p ? p.rate : 0;
}

// 税込金額に含まれる消費税額（1円未満切り捨て）
export function taxIncluded(amount, taxRate) {
  if (!TAX_RATES.includes(taxRate)) throw new Error(`税率は 8 または 10 を指定してください: ${taxRate}`);
  return Math.floor((amount * taxRate) / (100 + taxRate));
}

export function calcLine({ amount, taxRate = 10, date, smallAmountSpecial = false }) {
  const amt = parseAmount(amount);
  if (Number.isNaN(amt)) throw new Error('金額は0以上10兆円以下の整数で入力してください');
  const tax = taxIncluded(amt, taxRate);
  const baseRate = getRate(date);
  const small = smallAmountSpecial && amt < SMALL_AMOUNT.limit && date <= SMALL_AMOUNT.until && baseRate < 1;
  const rate = small ? 1 : baseRate;
  const deductible = applyRate(tax, rate);
  return { amount: amt, taxRate, date, tax, rate, rule: small ? 'small' : baseRate === 1 ? 'none' : 'transition', deductible, nonDeductible: tax - deductible };
}

export function calcTotal(lines) {
  const results = lines.map(calcLine);
  const sum = (k) => results.reduce((a, r) => a + r[k], 0);
  return { results, amount: sum('amount'), tax: sum('tax'), deductible: sum('deductible'), nonDeductible: sum('nonDeductible') };
}

// 年間支払額が一定の場合の、期間ごとの控除不能額（＝実質的な追加負担）の見通し
export function projection(annualAmount, taxRate = 10) {
  const amt = parseAmount(annualAmount);
  if (Number.isNaN(amt)) throw new Error('金額は0以上10兆円以下の整数で入力してください');
  const tax = taxIncluded(amt, taxRate);
  const rows = RATE_PERIODS.map((p) => {
    const deductible = applyRate(tax, p.rate);
    return { label: p.label, rate: p.rate, tax, deductible, nonDeductible: tax - deductible };
  });
  rows.push({ label: '2031/10〜', rate: 0, tax, deductible: 0, nonDeductible: tax });
  return rows;
}
