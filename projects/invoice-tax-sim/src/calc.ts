/** インボイス税額シミュレーター: 計算ロジック(純関数)。
 *  数値は令和8年度税制改正に関する二次情報に基づく。公開前に国税庁の原文で要確認。 */

export type Business = 1 | 2 | 3 | 4 | 5 | 6;
export const DEEMED_RATE: Record<Business, number> = { 1: 0.9, 2: 0.8, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.4 };

export interface Input {
  /** 課税売上(税抜・年額・円) */
  sales: number;
  /** 課税仕入・経費のうち消費税がかかるもの(税込・年額・円) */
  purchasesInclTax: number;
  /** 簡易課税の事業区分 */
  business: Business;
  /** 対象の年分(2026=2割特例, 2027/2028=3割特例, それ以外=特例なし) */
  year: number;
}

export interface Option {
  key: "exempt" | "honsoku" | "kani" | "special";
  label: string;
  /** 納付する消費税額(円, 0未満は還付として負値) */
  tax: number;
  available: boolean;
  note: string;
}

const floor = (n: number) => Math.floor(n);
export const SALES_TAX_RATE = 0.1;

export function specialRatio(year: number): number | null {
  if (year === 2026) return 0.2;
  if (year === 2027 || year === 2028) return 0.3;
  return null;
}

export function simulate(i: Input): Option[] {
  const sales = Math.max(0, floor(i.sales));
  const purch = Math.max(0, floor(i.purchasesInclTax));
  const outTax = floor(sales * SALES_TAX_RATE);
  const inTax = floor((purch * 10) / 110);
  const ratio = specialRatio(i.year);
  const kaniAvailable = sales <= 50_000_000;
  const opts: Option[] = [
    { key: "exempt", label: "免税事業者のまま(登録しない)・参考", tax: 0, available: sales <= 10_000_000,
      note: sales <= 10_000_000 ? "消費税の納付はなし。ただし取引先が仕入税額控除できず、値下げ要請や取引見直しの可能性があります。" : "基準期間の課税売上が1,000万円超の場合は課税事業者となります。" },
    { key: "honsoku", label: "本則課税", tax: outTax - inTax, available: true,
      note: "売上の消費税 − 仕入の消費税。マイナスなら還付。" },
    { key: "kani", label: `簡易課税(第${i.business}種・みなし仕入率${DEEMED_RATE[i.business] * 100}%)`,
      tax: floor(outTax * (1 - DEEMED_RATE[i.business])), available: kaniAvailable,
      note: kaniAvailable ? "事前の届出が必要です。" : "基準期間の課税売上が5,000万円以下の場合のみ利用可。" },
  ];
  if (ratio !== null) {
    opts.push({ key: "special", label: `${ratio * 10}割特例(売上税額の${ratio * 100}%)`, tax: floor(outTax * ratio), available: sales <= 10_000_000,
      note: sales > 10_000_000 ? "基準期間の課税売上が1,000万円以下の事業者が対象です。" : ratio === 0.2 ? "インボイス登録を機に課税事業者になった個人事業者・法人が対象(2026年9月30日までの課税期間)。" : "個人事業者のみ対象(予定)。要件は国税庁の最新情報で確認。" });
  }
  return opts;
}

/** 課税事業者として申告する場合の最小(免税は比較対象外)。 */
export function best(opts: Option[]): Option {
  return opts.filter((o) => o.available && o.key !== "exempt").reduce((a, b) => (b.tax < a.tax ? b : a));
}

/** 買手側の仕入税額控除割合(免税事業者からの仕入, 日付は購入日)。 */
export function buyerDeductionRatio(y: number, m: number): number {
  const ym = y * 12 + (m - 1);
  const t = (yy: number, mm: number) => yy * 12 + (mm - 1);
  if (ym < t(2023, 10)) return 1;
  if (ym < t(2026, 10)) return 0.8;
  if (ym < t(2028, 10)) return 0.7;
  if (ym < t(2030, 10)) return 0.5;
  if (ym < t(2031, 10)) return 0.3;
  return 0;
}

/** 免税事業者に年間 amountInclTax 円を払う取引先が、控除できずに負担する消費税額(目安)。 */
export function buyerBurden(amountInclTax: number, y: number, m: number): number {
  const tax = (Math.max(0, floor(amountInclTax)) * 10) / 110;
  return floor(tax * (1 - buyerDeductionRatio(y, m)));
}
