// 消費税 特例比較ロジック（純粋関数・ブラウザ/Node 共用）
// 税率は標準税率10%（国7.8%+地方2.2%）のみ対応。軽減税率(8%)は未対応（MVP）。

export const TAX_RATE = 0.1;
export const BASE_LIMIT_SPECIAL = 10_000_000; // 2割/3割特例: 基準期間課税売上高
export const BASE_LIMIT_SIMPLIFIED = 50_000_000; // 簡易課税

export const BUSINESS_TYPES = {
  1: { label: "第1種（卸売業）", rate: 0.9 },
  2: { label: "第2種（小売業・農林水産業[飲食料品]）", rate: 0.8 },
  3: { label: "第3種（製造業・建設業等）", rate: 0.7 },
  4: { label: "第4種（飲食店業・その他）", rate: 0.6 },
  5: { label: "第5種（サービス業・運輸通信業等）", rate: 0.5 },
  6: { label: "第6種（不動産業）", rate: 0.4 },
};

export const TAX_YEARS = {
  R8: "令和8年分（2026年）",
  R9: "令和9年分（2027年）",
  R10: "令和10年分（2028年）",
  R11: "令和11年分以降",
};

const MAX_YEN = 1_000_000_000_000; // 1兆円（Number精度の安全圏）

function toInt(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`${name} は0以上の数値を入力してください`);
  if (n > MAX_YEN) throw new RangeError(`${name} は${MAX_YEN.toLocaleString("ja-JP")}円以下で入力してください`);
  return Math.floor(n);
}

/**
 * @param {object} i
 * @param {number} i.sales 課税売上（税抜・年額・円）
 * @param {number} i.purchases 課税仕入（税抜・年額・円）
 * @param {number} i.baseYearSales 基準期間(2年前)の課税売上高（円）
 * @param {1|2|3|4|5|6} i.businessType 簡易課税の事業区分
 * @param {"R8"|"R9"|"R10"|"R11"} i.taxYear
 * @param {boolean} i.isIndividual 個人事業者か
 * @param {boolean} i.registeredFromExempt インボイス登録を機に課税事業者になったか
 */
export function calculate(i) {
  const sales = toInt(i.sales, "課税売上");
  const purchases = toInt(i.purchases, "課税仕入");
  const base = toInt(i.baseYearSales, "基準期間の課税売上高");
  const bt = BUSINESS_TYPES[i.businessType];
  if (!bt) throw new RangeError("事業区分が不正です");
  if (!TAX_YEARS[i.taxYear]) throw new RangeError("対象年が不正です");

  const salesTax = Math.floor(sales * TAX_RATE);
  const purchaseTax = Math.floor(purchases * TAX_RATE);
  const results = [];

  // 本則課税（常に選択可能）。マイナスは還付。
  results.push({
    key: "honsoku",
    label: "本則課税",
    eligible: true,
    tax: salesTax - purchaseTax,
    note: "売上税額 − 仕入税額。マイナスの場合は還付。帳簿・インボイスの保存が必要。",
  });

  // 簡易課税
  const kaniOk = base <= BASE_LIMIT_SIMPLIFIED;
  results.push({
    key: "kani",
    label: `簡易課税（みなし仕入率${bt.rate * 100}%）`,
    eligible: kaniOk,
    tax: Math.floor(salesTax * (1 - bt.rate)),
    note: kaniOk
      ? "事前の「簡易課税制度選択届出書」の提出が必要（提出期限は国税庁で要確認）。原則2年間継続。"
      : "基準期間の課税売上高が5,000万円を超えるため利用不可。",
  });

  // 2割特例（令和8年分まで）
  if (i.taxYear === "R8") {
    const ok = base <= BASE_LIMIT_SPECIAL && i.registeredFromExempt;
    results.push({
      key: "nitowari",
      label: "2割特例",
      eligible: ok,
      tax: Math.floor(salesTax * 0.2),
      note: ok
        ? i.isIndividual
          ? "売上税額の20%を納付。届出不要（申告書への付記）。個人は令和8年分が最後。"
          : "売上税額の20%を納付。法人は令和8年9月30日を含む課税期間が最後（決算月により異なる）。"
        : !i.registeredFromExempt
          ? "インボイス登録を機に課税事業者になった方が対象です。"
          : "基準期間の課税売上高が1,000万円を超えるため利用不可。",
    });
  }

  // 3割特例（個人事業者の令和9・10年分、令和8年度税制改正）
  if (i.taxYear === "R9" || i.taxYear === "R10") {
    const ok = i.isIndividual && base <= BASE_LIMIT_SPECIAL && i.registeredFromExempt;
    results.push({
      key: "sanwari",
      label: "3割特例",
      eligible: ok,
      tax: Math.floor(salesTax * 0.3),
      note: ok
        ? "売上税額の30%を納付。要件の詳細は最新の国税庁資料で必ず確認してください。"
        : !i.isIndividual
          ? "個人事業者のみが対象です（法人は対象外）。"
          : !i.registeredFromExempt
            ? "2割特例の対象者（インボイス登録を機に課税事業者となった方）が対象です。"
            : "基準期間の課税売上高が1,000万円を超えるため利用不可。",
    });
  }

  const eligible = results.filter((r) => r.eligible);
  const best = eligible.reduce((a, b) => (b.tax < a.tax ? b : a), eligible[0]);
  const worst = eligible.reduce((a, b) => (b.tax > a.tax ? b : a), eligible[0]);
  const exemptHint =
    base <= BASE_LIMIT_SPECIAL
      ? "参考: 基準期間の課税売上高が1,000万円以下なら、インボイス登録をやめて免税事業者に戻る選択肢もあります（取引先への影響は別途検討が必要）。"
      : null;

  return {
    salesTax,
    purchaseTax,
    results,
    best,
    savingVsWorst: worst.tax - best.tax,
    exemptHint,
  };
}

export function formatYen(n) {
  const s = Math.abs(n).toLocaleString("ja-JP");
  return (n < 0 ? "−" : "") + "¥" + s;
}
