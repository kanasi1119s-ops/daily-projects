/** 個人事業主向け 消費税 納付税額 概算ロジック（標準税率10%のみ・税込入力）。 */

export type TaxYear = 2026 | 2027 | 2028;
export type BusinessType = 1 | 2 | 3 | 4 | 5 | 6;
export type MethodId = "general" | "simplified" | "special20" | "special30";

export interface Input {
  year: TaxYear;
  /** 年間課税売上（税込・10%） */
  sales: number;
  /** 課税仕入れ（適格請求書あり・税込・10%） */
  purchasesQualified: number;
  /** 免税事業者等からの課税仕入れ（適格請求書なし・税込・10%） */
  purchasesUnqualified: number;
  businessType: BusinessType;
  /** 基準期間（2年前）の課税売上高 */
  baseSales: number;
  /** インボイス登録を機に免税事業者から課税事業者になったか */
  wasExempt: boolean;
}

export interface MethodResult {
  id: MethodId;
  label: string;
  available: boolean;
  /** 利用不可の理由 */
  reason?: string;
  /** 納付税額（マイナスは還付）。国税+地方消費税の合計概算 */
  tax: number;
  note?: string;
}

/** みなし仕入率（％・整数。浮動小数点誤差を避けるため整数で保持） */
export const DEEMED_PERCENT: Record<BusinessType, number> = {
  1: 90,
  2: 80,
  3: 70,
  4: 60,
  5: 50,
  6: 40,
};

/** 整数円 × 整数％ を切り捨てで計算 */
function pct(amount: number, percent: number): number {
  return Math.floor((amount * percent) / 100);
}

export const BUSINESS_LABEL: Record<BusinessType, string> = {
  1: "第1種（卸売業）",
  2: "第2種（小売業・農林水産業の飲食料品譲渡）",
  3: "第3種（製造業・建設業・農林水産業など）",
  4: "第4種（飲食店業など）",
  5: "第5種（運輸通信・金融保険・サービス業）",
  6: "第6種（不動産業）",
};

/**
 * 免税事業者等からの仕入に係る経過措置の控除割合（‰・整数。暦年で仕入が月ごとに均等と仮定した加重平均）。
 * 〜令和8/9/30: 80% / 令和8/10/1〜令和10/9/30: 70% / 令和10/10/1〜令和12/9/30: 50%
 */
export function unqualifiedDeductionPermille(year: TaxYear): number {
  switch (year) {
    case 2026:
      return 775; // (9×80% + 3×70%) / 12
    case 2027:
      return 700;
    case 2028:
      return 650; // (9×70% + 3×50%) / 12
  }
}

/** 税込金額から消費税額（国税7.8%+地方2.2%＝10/110）を切り捨てで算出 */
function taxIncluded(amount: number): number {
  return Math.floor((amount * 10) / 110);
}

function clean(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function calculate(raw: Input): MethodResult[] {
  const sales = clean(raw.sales);
  const pq = clean(raw.purchasesQualified);
  const pu = clean(raw.purchasesUnqualified);
  const base = clean(raw.baseSales);

  const salesTax = taxIncluded(sales);

  const general =
    salesTax -
    taxIncluded(pq) -
    Math.floor((pu * 10 * unqualifiedDeductionPermille(raw.year)) / (110 * 1000));

  const results: MethodResult[] = [];

  results.push({
    id: "general",
    label: "原則課税",
    available: true,
    tax: general,
    note: "実際の課税仕入れ等に基づく計算。記帳・インボイス保存が前提。",
  });

  const simplifiedOk = base <= 50_000_000;
  results.push({
    id: "simplified",
    label: `簡易課税（${BUSINESS_LABEL[raw.businessType]}）`,
    available: simplifiedOk,
    reason: simplifiedOk ? undefined : "基準期間の課税売上高が5,000万円超のため対象外",
    tax: salesTax - pct(salesTax, DEEMED_PERCENT[raw.businessType]),
    note: "事前の届出が必要（適用開始年の前年12/31まで。例外・移行措置あり→要確認）。",
  });

  const specialBase = raw.wasExempt && base <= 10_000_000;
  const specialReason = !raw.wasExempt
    ? "インボイス登録を機に課税事業者になった方のみ対象"
    : base > 10_000_000
      ? "基準期間の課税売上高が1,000万円超のため対象外"
      : undefined;

  results.push({
    id: "special20",
    label: "2割特例（売上税額×20%）",
    available: specialBase && raw.year === 2026,
    reason: raw.year !== 2026 ? "令和8年（2026年）分で終了" : specialReason,
    tax: pct(salesTax, 20),
    note: "届出不要。確定申告書に適用する旨を記載。",
  });

  results.push({
    id: "special30",
    label: "3割特例（売上税額×30%）",
    available: specialBase && raw.year !== 2026,
    reason: raw.year === 2026 ? "令和9年・10年分のみの特例" : specialReason,
    tax: pct(salesTax, 30),
    note: "個人事業者のみ。届出不要。確定申告書に適用する旨を記載。",
  });

  return results;
}

/** 利用可能な方式のうち納付税額が最小のもの。 */
export function cheapest(results: MethodResult[]): MethodResult | undefined {
  return results
    .filter((r) => r.available)
    .reduce<MethodResult | undefined>((a, b) => (!a || b.tax < a.tax ? b : a), undefined);
}
