// インボイス経過措置の試算ロジック(DOM非依存)。
// 控除率は令和8年度税制改正後のスケジュール。法令・通達で必ず最終確認すること。
export const SCHEDULE = [
  { from: '2023-10-01', to: '2026-09-30', pct: 80 },
  { from: '2026-10-01', to: '2028-09-30', pct: 70 },
  { from: '2028-10-01', to: '2030-09-30', pct: 50 },
  { from: '2030-10-01', to: '2031-09-30', pct: 30 },
];
export const FIRST_DATE = SCHEDULE[0].from;
export const LAST_DATE = SCHEDULE[SCHEDULE.length - 1].to;

const ROUNDERS = { floor: Math.floor, round: Math.round, ceil: Math.ceil };

export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// 免税事業者等からの仕入れに適用される控除率(%)。範囲外は {pct, note} で理由を返す。
export function deductionPct(date) {
  if (!isValidDate(date)) throw new RangeError('日付は YYYY-MM-DD 形式の実在日で指定してください');
  if (date < FIRST_DATE) return { pct: 100, note: '制度開始前(2023-09-30以前)のため全額控除' };
  if (date > LAST_DATE) return { pct: 0, note: '経過措置終了後(2031-10-01以降)のため控除なし' };
  const s = SCHEDULE.find((x) => date >= x.from && date <= x.to);
  return { pct: s.pct, note: '' };
}

// 1取引分の試算。amount は円(非負の整数)。
export function calcLine({ amount, taxIncluded = true, taxRate = 10, date, supplier = 'unregistered', rounding = 'floor' }) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError('金額は0以上の整数(円)で指定してください');
  if (![8, 10].includes(taxRate)) throw new RangeError('税率は 8 または 10 を指定してください');
  if (!['qualified', 'unregistered'].includes(supplier)) throw new RangeError('仕入先区分が不正です');
  if (!isValidDate(date)) throw new RangeError('日付は YYYY-MM-DD 形式の実在日で指定してください');
  const rnd = ROUNDERS[rounding];
  if (!rnd) throw new RangeError('端数処理は floor / round / ceil のいずれかです');

  const tax = taxIncluded ? rnd((amount * taxRate) / (100 + taxRate)) : rnd((amount * taxRate) / 100);
  const base = taxIncluded ? amount - tax : amount;
  let pct, note = '';
  if (supplier === 'qualified') pct = 100;
  else ({ pct, note } = deductionPct(date));
  const deductible = rnd((tax * pct) / 100);
  return { base, tax, pct, deductible, nonDeductible: tax - deductible, note };
}

export function summarize(rows) {
  return rows.reduce(
    (a, r) => ({ tax: a.tax + r.tax, deductible: a.deductible + r.deductible, nonDeductible: a.nonDeductible + r.nonDeductible }),
    { tax: 0, deductible: 0, nonDeductible: 0 },
  );
}
