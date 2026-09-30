/**
 * 消費税 納付税額の試算ロジック（純関数）。
 * 金額はすべて「税抜・年額（課税期間分）」の円。税率は国税+地方税の合計（10% / 8%）。
 * 実際の申告は取引ごとの端数処理等で差が出るため、あくまで概算。
 */

export type BusinessType = 1 | 2 | 3 | 4 | 5 | 6;
export type Taxpayer = 'individual' | 'corporation';
export type MethodId = 'standard' | 'simplified' | 'twenty' | 'thirty';

export const DEEMED_RATE: Record<BusinessType, number> = {
  1: 0.9,
  2: 0.8,
  3: 0.7,
  4: 0.6,
  5: 0.5,
  6: 0.4,
};

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  1: '第1種 卸売業（90%）',
  2: '第2種 小売業（80%）',
  3: '第3種 製造業・建設業など（70%）',
  4: '第4種 飲食店業など（60%）',
  5: '第5種 サービス業・運輸通信業など（50%）',
  6: '第6種 不動産業（40%）',
};

export const RATE_STANDARD = 0.1;
export const RATE_REDUCED = 0.08;

export interface Input {
  salesStd: number;
  salesReduced: number;
  purchasesStd: number;
  purchasesReduced: number;
  exemptPurchasesStd: number;
  exemptPurchasesReduced: number;
  /** 免税事業者等からの仕入に適用する控除割合（0〜1） */
  exemptDeductionRate: number;
  businessType: BusinessType;
  taxpayer: Taxpayer;
  periodStart: string;
  periodEnd: string;
  /** 免税事業者だったが、インボイス発行事業者の登録で課税事業者になった */
  registeredFromExempt: boolean;
  /** 基準期間（原則2年前）の課税売上高（税抜） */
  baseSales: number;
}

export interface MethodResult {
  id: MethodId;
  label: string;
  eligible: boolean;
  /** 納付（正）／還付（負）見込額。対象外でも参考値として計算する */
  tax: number;
  /** 対象外・注意の理由 */
  notes: string[];
}

export interface Comparison {
  salesTax: number;
  results: MethodResult[];
  /** 対象となる方法のうち試算上の納付額が最小のもの */
  cheapestId: MethodId | null;
  warnings: string[];
}

/** 入力の上限（浮動小数点の精度を保つため） */
export const MAX_YEN = 10_000_000_000_000;
const yen = (n: number): number => (Number.isFinite(n) ? Math.min(MAX_YEN, Math.max(0, Math.floor(n))) : 0);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** 免税事業者等からの課税仕入れに係る控除割合（令和8年度改正後の経過措置）。 */
export function exemptPurchaseDeductionRate(date: string): number {
  if (!ISO.test(date)) throw new Error(`invalid date: ${date}`);
  if (date < '2023-10-01') return 1;
  if (date <= '2026-09-30') return 0.8;
  if (date <= '2028-09-30') return 0.7;
  if (date <= '2030-09-30') return 0.5;
  if (date <= '2031-09-30') return 0.3;
  return 0;
}

const DAY = 86_400_000;
const toDay = (d: string): number => Date.parse(`${d}T00:00:00Z`) / DAY;

/**
 * 課税期間内で仕入が均等に発生したと仮定し、日ごとの控除割合を日数で加重平均する（概算）。
 * 期間の途中で控除割合が切り替わる場合（例: 令和8年分は10月1日から70%）の目安に使う。
 */
export function weightedExemptDeductionRate(start: string, end: string): number {
  if (!ISO.test(start) || !ISO.test(end) || end < start) return 0;
  const s = toDay(start);
  const e = toDay(end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  const cuts = ['2023-10-01', '2026-10-01', '2028-10-01', '2030-10-01', '2031-10-01'].map(toDay);
  const edges = [s, ...cuts.filter((c) => c > s && c <= e), e + 1];
  let total = 0;
  for (let k = 0; k < edges.length - 1; k++) {
    const from = new Date(edges[k] * DAY).toISOString().slice(0, 10);
    total += exemptPurchaseDeductionRate(from) * (edges[k + 1] - edges[k]);
  }
  return total / (e + 1 - s);
}

export function calcSalesTax(i: Pick<Input, 'salesStd' | 'salesReduced'>): number {
  return Math.floor(yen(i.salesStd) * RATE_STANDARD + yen(i.salesReduced) * RATE_REDUCED);
}

export function calcInputTax(i: Input): number {
  const registered = yen(i.purchasesStd) * RATE_STANDARD + yen(i.purchasesReduced) * RATE_REDUCED;
  const rate = Math.min(1, Math.max(0, i.exemptDeductionRate));
  const exempt =
    (yen(i.exemptPurchasesStd) * RATE_STANDARD + yen(i.exemptPurchasesReduced) * RATE_REDUCED) * rate;
  return Math.floor(registered + exempt);
}

export function validate(i: Input): string[] {
  const errs: string[] = [];
  if (!ISO.test(i.periodStart) || !ISO.test(i.periodEnd)) errs.push('課税期間の日付を入力してください。');
  else if (i.periodEnd < i.periodStart) errs.push('課税期間の終了日は開始日以降にしてください。');
  return errs;
}

export function compare(i: Input): Comparison {
  const warnings = validate(i);
  const salesTax = calcSalesTax(i);
  const baseSales = yen(i.baseSales);
  const datesOk = warnings.length === 0;

  // 本則課税
  const standard: MethodResult = {
    id: 'standard',
    label: '本則課税',
    eligible: true,
    tax: salesTax - calcInputTax(i),
    notes: ['実際の課税仕入れ（インボイス保存が要件）に基づく計算。負の値は還付見込みです。'],
  };

  // 簡易課税
  const simplifiedNotes = ['事前に「簡易課税制度選択届出書」の提出が必要です（原則、適用開始課税期間の前日まで）。'];
  const simplifiedOk = baseSales <= 50_000_000;
  if (!simplifiedOk) simplifiedNotes.unshift('基準期間の課税売上高が5,000万円を超えるため対象外です。');
  const simplified: MethodResult = {
    id: 'simplified',
    label: `簡易課税（${BUSINESS_TYPE_LABEL[i.businessType].slice(0, 3)}）`,
    eligible: simplifiedOk,
    tax: Math.floor(salesTax * (1 - DEEMED_RATE[i.businessType])),
    notes: [...simplifiedNotes, '複数事業を営む場合は事業区分ごとの計算が必要で、この試算は単一区分のみ対応です。'],
  };

  // 2割特例
  const twentyNotes: string[] = [];
  if (!i.registeredFromExempt) twentyNotes.push('免税事業者からインボイス登録で課税事業者になった場合のみ対象です。');
  if (baseSales > 10_000_000) twentyNotes.push('基準期間の課税売上高が1,000万円を超えるため対象外です。');
  if (datesOk && !(i.periodStart <= '2026-09-30' && i.periodEnd >= '2023-10-01'))
    twentyNotes.push('課税期間が令和5年10月1日〜令和8年9月30日にかかっていないため対象外です（令和8年9月30日で終了）。');
  const twenty: MethodResult = {
    id: 'twenty',
    label: '2割特例',
    eligible: datesOk && twentyNotes.length === 0,
    tax: Math.floor(salesTax * 0.2),
    notes: twentyNotes.length ? twentyNotes : ['売上税額の2割を納付。届出不要（申告書に適用の旨を記載）。'],
  };

  // 3割特例（令和8年度税制改正：個人事業者・令和9・10年分）
  const thirtyNotes: string[] = [];
  if (i.taxpayer !== 'individual') thirtyNotes.push('個人事業者のみが対象です（法人は対象外）。');
  if (!i.registeredFromExempt) thirtyNotes.push('免税事業者からインボイス登録で課税事業者になった場合のみ対象です。');
  if (baseSales > 10_000_000) thirtyNotes.push('基準期間の課税売上高が1,000万円を超えるため対象外です。');
  if (datesOk && !(i.periodStart >= '2027-01-01' && i.periodEnd <= '2028-12-31'))
    thirtyNotes.push('令和9年分・令和10年分（2027年・2028年）のみが対象期間です。');
  const thirty: MethodResult = {
    id: 'thirty',
    label: '3割特例（個人・令和9〜10年分）',
    eligible: datesOk && thirtyNotes.length === 0,
    tax: Math.floor(salesTax * 0.3),
    notes: thirtyNotes.length
      ? thirtyNotes
      : ['売上税額の3割を納付。令和8年度税制改正に基づく内容です。公布された条文・国税庁の最新情報で必ず確認してください。'],
  };

  const results = [standard, simplified, twenty, thirty];
  const eligible = results.filter((r) => r.eligible);
  const cheapest = eligible.reduce<MethodResult | null>((a, r) => (a === null || r.tax < a.tax ? r : a), null);
  return { salesTax, results, cheapestId: cheapest?.id ?? null, warnings };
}
