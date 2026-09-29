// 消費税計算ロジック(純関数・DOM非依存)。金額は全て整数円。
// 注意: 税制は令和8年度税制改正大綱ベース。公式情報での確認が必要。

export const NATIONAL_RATE = { 10: 7.8, 8: 6.24 }; // 国税分(%)

// 免税事業者等からの仕入税額控除の経過措置(取引日で判定)
export const TRANSITIONAL_SCHEDULE = [
  { from: "2023-10-01", to: "2026-09-30", ratio: 0.8 },
  { from: "2026-10-01", to: "2028-09-30", ratio: 0.7 },
  { from: "2028-10-01", to: "2030-09-30", ratio: 0.5 },
  { from: "2030-10-01", to: "2031-09-30", ratio: 0.3 },
];

// 簡易課税のみなし仕入率
export const DEEMED_RATIO = { 1: 0.9, 2: 0.8, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.4 };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_AMOUNT = 1e13; // 10兆円。浮動小数の精度劣化を防ぐ上限

function assertAmount(n, name) {
  if (!Number.isInteger(n) || n < 0 || n > MAX_AMOUNT) {
    throw new RangeError(`${name}は0以上10兆円以下の整数(円)で指定してください`);
  }
}

/** 取引日(YYYY-MM-DD)から経過措置の控除割合を返す。範囲外は 0(または適用前は 1)。 */
export function transitionalRatio(dateStr) {
  if (typeof dateStr !== "string" || !DATE_RE.test(dateStr) || Number.isNaN(Date.parse(dateStr))) {
    throw new RangeError("取引日はYYYY-MM-DD形式で指定してください");
  }
  if (dateStr < TRANSITIONAL_SCHEDULE[0].from) return 1; // インボイス制度開始前
  for (const p of TRANSITIONAL_SCHEDULE) {
    if (dateStr >= p.from && dateStr <= p.to) return p.ratio;
  }
  return 0;
}

/** 税込金額から国税分の消費税額(1円未満切捨て)。 */
export function nationalTaxFromGross(gross, rate = 10) {
  assertAmount(gross, "金額");
  const r = NATIONAL_RATE[rate];
  if (r === undefined) throw new RangeError("税率は10または8を指定してください");
  return Math.floor((gross * r) / (100 + rate));
}

/** 免税事業者等からの仕入れ1件の控除可否計算。 */
export function unregisteredPurchase(gross, rate, dateStr) {
  const tax = nationalTaxFromGross(gross, rate);
  const ratio = transitionalRatio(dateStr);
  const deductible = Math.floor(tax * ratio);
  return { tax, ratio, deductible, nonDeductible: tax - deductible };
}

/** 売上側: 税込売上→課税標準額(税抜・1,000円未満切捨て)→国税分の売上税額。 */
export function salesTaxFromGross(gross, rate = 10) {
  assertAmount(gross, "金額");
  if (NATIONAL_RATE[rate] === undefined) throw new RangeError("税率は10または8を指定してください");
  const base = Math.floor(Math.floor((gross * 100) / (100 + rate)) / 1000) * 1000;
  return Math.floor((base * NATIONAL_RATE[rate]) / 100);
}

const floor100 = (n) => Math.floor(n / 100) * 100;

/** 国税の納付税額(100円未満切捨て)に地方消費税(国税×22/78、100円未満切捨て)を加えた合計。 */
export function withLocal(national) {
  const n = floor100(national);
  return n + floor100(Math.floor((n * 22) / 78));
}

/** 申告年分ごとに利用可能な特例。 */
export function availableSpecials(taxYear) {
  return { niwari: taxYear <= 2026, sanwari: taxYear === 2027 || taxYear === 2028 };
}

/**
 * 各方式の納付税額(国税)を比較する。
 * input: { taxYear, sales10, sales8, businessType, purchases10, purchases8,
 *          unregPurchases10, unregPurchases8, unregRatio }
 *  - sales*: 課税売上(税込)
 *  - purchases*: 適格請求書ありの課税仕入(税込)
 *  - unregPurchases*: 免税事業者等からの課税仕入(税込)
 *  - unregRatio: 経過措置の控除割合(0〜1)
 */
export function compareMethods(input) {
  const {
    taxYear, sales10 = 0, sales8 = 0, businessType = 5,
    purchases10 = 0, purchases8 = 0, unregPurchases10 = 0, unregPurchases8 = 0,
    unregRatio = 0.7,
  } = input;
  [sales10, sales8, purchases10, purchases8, unregPurchases10, unregPurchases8].forEach((v) =>
    assertAmount(v, "金額"),
  );
  if (!Number.isInteger(taxYear) || taxYear < 2023) throw new RangeError("申告年分が不正です");
  if (!(unregRatio >= 0 && unregRatio <= 1)) throw new RangeError("控除割合は0〜1で指定してください");
  if (!(businessType in DEEMED_RATIO)) throw new RangeError("事業区分は1〜6で指定してください");

  const salesTax = salesTaxFromGross(sales10, 10) + salesTaxFromGross(sales8, 8);
  const inputTax =
    nationalTaxFromGross(purchases10, 10) + nationalTaxFromGross(purchases8, 8) +
    Math.floor(
      (nationalTaxFromGross(unregPurchases10, 10) + nationalTaxFromGross(unregPurchases8, 8)) * unregRatio,
    );

  const avail = availableSpecials(taxYear);
  const results = [];
  const push = (key, label, national) =>
    results.push({ key, label, national: floor100(national), total: withLocal(national) });

  push("honsoku", "本則課税", Math.max(0, salesTax - inputTax));
  push("kani", "簡易課税", Math.floor(salesTax * (1 - DEEMED_RATIO[businessType])));
  if (avail.niwari) push("niwari", "2割特例", Math.floor(salesTax * 0.2));
  if (avail.sanwari) push("sanwari", "3割特例", Math.floor(salesTax * 0.3));

  const cheapest = results.reduce((a, b) => (b.total < a.total ? b : a));
  return { salesTax, inputTax, results, cheapest: cheapest.key };
}
