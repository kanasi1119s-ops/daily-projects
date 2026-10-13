// 消費税 納税額の方式別試算ロジック（国税+地方税の合計 10% 前提・標準税率のみ）

export const TAX_RATE = 0.1;
export const EXEMPT_THRESHOLD = 10_000_000; // 免税事業者の基準期間売上上限
export const SIMPLIFIED_LIMIT = 50_000_000; // 簡易課税の基準期間売上上限

export const BUSINESS_TYPES = {
  1: { label: '第1種（卸売業）', rate: 0.9 },
  2: { label: '第2種（小売業・農林水産業(飲食料品)）', rate: 0.8 },
  3: { label: '第3種（製造業・建設業など）', rate: 0.7 },
  4: { label: '第4種（飲食店業・その他）', rate: 0.6 },
  5: { label: '第5種（サービス業・運輸通信業など）', rate: 0.5 },
  6: { label: '第6種（不動産業）', rate: 0.4 },
};

/** 税込金額から含まれる消費税額（10%）を求める */
export function taxIncluded(amountInclTax) {
  // 浮動小数点誤差を避けるため整数の乗除で計算する（10/110）
  return (amountInclTax * 10) / 110;
}

/** 納税額は 100円未満切捨て（還付は絶対値で切捨て）。 */
function floorTo100(n) {
  return n >= 0 ? Math.floor(n / 100) * 100 : -Math.floor(-n / 100) * 100;
}

/**
 * @param {{sales:number, purchases:number, businessType:number, baseYearSales?:number, wasExempt?:boolean, taxYear?:number}} input
 *  sales / purchases: 年間の課税売上・課税仕入（税込・円）
 *  baseYearSales: 基準期間の課税売上高（税抜）。未指定なら sales/1.1 で代用
 *  wasExempt: インボイス登録前に免税事業者だったか（2割特例の対象条件）
 *  taxYear: 課税期間の年（暦年の個人事業主を想定）
 */
export function simulate(input) {
  const { sales, purchases, businessType } = input;
  const taxYear = input.taxYear ?? 2027;
  const wasExempt = input.wasExempt ?? true;
  const errors = [];
  const MAX = 10_000_000_000_000; // 10兆円。桁あふれ・入力ミス防止
  const bad = (v) => !Number.isFinite(v) || v < 0 || v > MAX;
  if (bad(sales)) errors.push('売上は0〜10兆円の整数で入力してください。');
  if (bad(purchases)) errors.push('仕入・経費は0〜10兆円の整数で入力してください。');
  if (input.baseYearSales !== undefined && bad(input.baseYearSales)) errors.push('基準期間の売上は0〜10兆円の整数で入力するか、空欄にしてください。');
  if (!BUSINESS_TYPES[businessType]) errors.push('業種区分が不正です。');
  if (errors.length) return { ok: false, errors };

  const baseSales = input.baseYearSales ?? Math.round(sales / (1 + TAX_RATE));
  const outputTax = taxIncluded(sales);
  const inputTax = taxIncluded(purchases);
  const deemed = BUSINESS_TYPES[businessType].rate;
  const deemedPct = Math.round(deemed * 100);

  const methods = [];

  methods.push({
    key: 'general',
    label: '本則課税',
    tax: floorTo100(outputTax - inputTax),
    eligible: true,
    note: '実際の課税仕入にかかる消費税を控除します。仕入が多いと有利です。',
  });

  const simpEligible = baseSales <= SIMPLIFIED_LIMIT;
  methods.push({
    key: 'simplified',
    label: `簡易課税（みなし仕入率${deemedPct}%）`,
    tax: floorTo100((outputTax * (100 - deemedPct)) / 100),
    eligible: simpEligible,
    note: simpEligible
      ? '適用開始の課税期間の前日までに「簡易課税制度選択届出書」の提出が必要です。'
      : '基準期間の課税売上高が5,000万円を超えるため選択できません。',
  });

  // 2割特例: 2023-10-01〜2026-09-30 を含む課税期間まで。暦年なら 2026年分が最終。
  const twentyEligible = wasExempt && taxYear <= 2026 && baseSales <= EXEMPT_THRESHOLD;
  methods.push({
    key: 'twenty',
    label: '2割特例',
    tax: floorTo100((outputTax * 20) / 100),
    eligible: twentyEligible,
    note: !wasExempt
      ? 'インボイス登録前に免税事業者だった方のみ対象です。'
      : taxYear > 2026
        ? '2026年9月30日を含む課税期間で終了しており、2027年分以降は使えません（要最新確認）。'
        : baseSales > EXEMPT_THRESHOLD
          ? '基準期間の課税売上高が1,000万円を超えると対象外です。'
          : '売上税額の20%を納税額とする経過措置です。',
  });

  const candidates = methods.filter((m) => m.eligible);
  const best = candidates.reduce((a, b) => (b.tax < a.tax ? b : a), candidates[0]);
  const worst = candidates.reduce((a, b) => (b.tax > a.tax ? b : a), candidates[0]);

  return {
    ok: true,
    outputTax: Math.floor(outputTax),
    inputTax: Math.floor(inputTax),
    exemptionPossible: baseSales <= EXEMPT_THRESHOLD,
    methods,
    bestKey: best.key,
    saving: worst.tax - best.tax,
  };
}
