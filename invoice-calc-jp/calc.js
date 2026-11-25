// 請求書・インボイス計算ロジック（DOM非依存・整数演算）
export const ROUNDINGS = ['floor', 'round', 'ceil'];

function roundDiv(num, den, mode) {
  // num/den を整数に丸める（num>=0, den>0）
  const q = Math.floor(num / den);
  const r = num - q * den;
  if (r === 0) return q;
  if (mode === 'floor') return q;
  if (mode === 'ceil') return q + 1;
  return r * 2 >= den ? q + 1 : q; // round（四捨五入）
}

function assertAmount(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 1e12) {
    throw new RangeError('金額は0以上1兆円以下の整数（円）で指定してください');
  }
}

/** 税抜/税込から本体・消費税・税込を算出（1請求書単位の端数処理） */
export function splitTax(amount, mode = 'excl', rate = 10, rounding = 'floor') {
  assertAmount(amount);
  if (![8, 10].includes(rate)) throw new RangeError('税率は8または10');
  if (!ROUNDINGS.includes(rounding)) throw new RangeError('端数処理が不正です');
  if (mode === 'excl') {
    const tax = roundDiv(amount * rate, 100, rounding);
    return { net: amount, tax, gross: amount + tax };
  }
  if (mode === 'incl') {
    const tax = roundDiv(amount * rate, 100 + rate, rounding);
    return { net: amount - tax, tax, gross: amount };
  }
  throw new RangeError('modeはexclまたはincl');
}

/** 源泉徴収税額（報酬・料金等 所得税法204条, 復興特別所得税込）。基準額は税抜（請求書で区分記載の場合） */
export function withholding(base) {
  assertAmount(base);
  const LIMIT = 1_000_000;
  if (base <= LIMIT) return Math.floor((base * 1021) / 10000);
  return Math.floor(((base - LIMIT) * 2042) / 10000) + 102_100;
}

/** 免税事業者等からの仕入に係る経過措置の控除割合（%）。date: 'YYYY-MM-DD' */
export function transitionalRate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new RangeError('日付はYYYY-MM-DD形式');
  }
  if (date < '2023-10-01') return 100;
  if (date <= '2026-09-30') return 80;
  if (date <= '2029-09-30') return 50;
  return 0;
}

/** 免税事業者へ支払う場合の仕入税額控除の目安 */
export function exemptPurchaseCredit(taxAmount, date) {
  assertAmount(taxAmount);
  const rate = transitionalRate(date);
  const deductible = Math.floor((taxAmount * rate) / 100);
  return { rate, deductible, nonDeductible: taxAmount - deductible };
}

/** 請求書の合計（源泉徴収あり）: 受取額 = 税込 - 源泉 */
export function invoiceTotal(net, { rate = 10, rounding = 'floor', withhold = false } = {}) {
  const s = splitTax(net, 'excl', rate, rounding);
  const wh = withhold ? withholding(net) : 0;
  return { ...s, withholding: wh, payout: s.gross - wh };
}
