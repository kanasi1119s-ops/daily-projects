/**
 * 消費税 納付税額シミュレーション（概算）。
 * 本則課税 / 簡易課税 / 2割特例 を同条件で比較する純粋関数群。
 * 税理士による税務判断の代替ではない。国税+地方消費税を合算した税率(10% / 8%)で計算する。
 */

export type BusinessType = 1 | 2 | 3 | 4 | 5 | 6;

/** 簡易課税のみなし仕入率（第1種〜第6種） */
export const DEEMED_RATE: Record<BusinessType, number> = {
  1: 0.9, 2: 0.8, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.4,
};

export const BUSINESS_LABEL: Record<BusinessType, string> = {
  1: "第1種（卸売業）",
  2: "第2種（小売業・農林水産業(飲食料品)）",
  3: "第3種（製造業・建設業など）",
  4: "第4種（飲食店業・その他）",
  5: "第5種（運輸通信・金融保険・サービス業）",
  6: "第6種（不動産業）",
};

export interface Input {
  /** 課税売上（税込） 標準税率10% */
  sales10: number;
  /** 課税売上（税込） 軽減税率8% */
  sales8: number;
  /** 課税仕入（税込・適格請求書あり） 10% */
  qualPurchase10: number;
  /** 課税仕入（税込・適格請求書あり） 8% */
  qualPurchase8: number;
  /** 課税仕入（税込・免税事業者等からの仕入） 10% */
  nonQualPurchase10: number;
  /** 課税仕入（税込・免税事業者等からの仕入） 8% */
  nonQualPurchase8: number;
  /** 免税事業者等からの仕入の経過措置控除割合（0.8 / 0.7 / 0.5 / 0） */
  transitionRate: number;
  /** 簡易課税の事業区分 */
  businessType: BusinessType;
  /** 基準期間（原則2年前）の課税売上高（税抜） */
  baseSales: number;
  /** インボイス登録のために課税事業者になった（もとは免税事業者）か */
  wasExempt: boolean;
  /** 課税期間が2割特例の適用期間（令和5年10月1日〜令和8年9月30日を含む課税期間）か */
  inTwentyPercentPeriod: boolean;
}

export type MethodKey = "standard" | "simplified" | "twenty";

export interface MethodResult {
  key: MethodKey;
  label: string;
  available: boolean;
  /** 利用不可の理由 / 注意点 */
  note: string;
  /** 納付税額（マイナスは還付見込み）。利用不可のときは null */
  tax: number | null;
}

export interface Result {
  outputTax: number;
  inputTaxStandard: number;
  methods: MethodResult[];
  /** 利用可能な方式のうち最も納付額が小さいもの */
  best: MethodKey | null;
  warnings: string[];
}

/** 入力上限（1,000億円）。桁あふれによる誤表示を防ぐ */
export const MAX_AMOUNT = 100_000_000_000;

const clean = (n: number): number =>
  Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), MAX_AMOUNT) : 0;

/** 税込金額から消費税額（10/110, 8/108）を切り捨てで算出 */
export function taxPortion(amount: number, rate: 10 | 8): number {
  const a = clean(amount);
  return rate === 10 ? Math.floor((a * 10) / 110) : Math.floor((a * 8) / 108);
}

export function calculate(raw: Input): Result {
  const i: Input = {
    ...raw,
    sales10: clean(raw.sales10),
    sales8: clean(raw.sales8),
    qualPurchase10: clean(raw.qualPurchase10),
    qualPurchase8: clean(raw.qualPurchase8),
    nonQualPurchase10: clean(raw.nonQualPurchase10),
    nonQualPurchase8: clean(raw.nonQualPurchase8),
    baseSales: clean(raw.baseSales),
    transitionRate: Math.min(1, Math.max(0, Number.isFinite(raw.transitionRate) ? raw.transitionRate : 0)),
  };

  const outputTax = taxPortion(i.sales10, 10) + taxPortion(i.sales8, 8);

  const qualTax = taxPortion(i.qualPurchase10, 10) + taxPortion(i.qualPurchase8, 8);
  const nonQualTax = taxPortion(i.nonQualPurchase10, 10) + taxPortion(i.nonQualPurchase8, 8);
  const inputTaxStandard = qualTax + Math.floor(nonQualTax * i.transitionRate);

  const warnings: string[] = [];
  const methods: MethodResult[] = [];

  // 本則課税
  methods.push({
    key: "standard",
    label: "本則課税",
    available: true,
    note: "売上税額 − 仕入税額。マイナスなら還付見込み。",
    tax: outputTax - inputTaxStandard,
  });

  // 簡易課税
  const simplifiedOk = i.baseSales <= 50_000_000;
  methods.push({
    key: "simplified",
    label: `簡易課税（みなし仕入率${DEEMED_RATE[i.businessType] * 100}%）`,
    available: simplifiedOk,
    note: simplifiedOk
      ? "適用には事前の「簡易課税制度選択届出書」の提出が必要です。2事業年度は継続適用。事業区分が複数ある場合は本ツールでは扱えません。"
      : "基準期間の課税売上高が5,000万円を超えるため選択できません。",
    tax: simplifiedOk ? outputTax - Math.floor(outputTax * DEEMED_RATE[i.businessType]) : null,
  });

  // 2割特例
  const twentyOk = i.wasExempt && i.inTwentyPercentPeriod && i.baseSales <= 10_000_000;
  let twentyNote: string;
  if (!i.inTwentyPercentPeriod) {
    twentyNote = "適用期間（令和8年9月30日までの日を含む課税期間）外のため選択できません。";
  } else if (!i.wasExempt) {
    twentyNote = "インボイス登録を機に課税事業者になった方のみが対象です。";
  } else if (i.baseSales > 10_000_000) {
    twentyNote = "基準期間の課税売上高が1,000万円を超えるため対象外です。";
  } else {
    twentyNote = "売上税額の20%を納付。届出不要（申告書に適用を記載）。";
  }
  methods.push({
    key: "twenty",
    label: "2割特例",
    available: twentyOk,
    note: twentyNote,
    tax: twentyOk ? Math.floor(outputTax * 0.2) : null,
  });

  let best: MethodKey | null = null;
  let bestTax = Infinity;
  for (const m of methods) {
    if (m.available && m.tax !== null && m.tax < bestTax) {
      bestTax = m.tax;
      best = m.key;
    }
  }

  const raws = [raw.sales10, raw.sales8, raw.qualPurchase10, raw.qualPurchase8, raw.nonQualPurchase10, raw.nonQualPurchase8, raw.baseSales];
  if (raws.some((v) => Number.isFinite(v) && v > MAX_AMOUNT)) {
    warnings.push("入力が上限（1,000億円）を超えたため上限値として計算しました。");
  }
  if (outputTax === 0) warnings.push("課税売上が0円です。入力内容を確認してください。");
  if (i.nonQualPurchase10 + i.nonQualPurchase8 > 0 && i.transitionRate === 0) {
    warnings.push("免税事業者等からの仕入の控除割合が0%です。経過措置は令和11年9月30日まで段階的に縮小します（〜令和8年9月:80%、令和8年10月〜令和11年9月:50%）。");
  }

  return { outputTax, inputTaxStandard, methods, best, warnings };
}
