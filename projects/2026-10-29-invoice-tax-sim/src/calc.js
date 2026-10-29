// 消費税（国税7.8%＋地方消費税2.2%）の合算税率で概算する純粋関数群。
// 端数処理は最終納付額のみ円未満切捨て。実際の申告額とは異なる場合がある。

export const MIN_RATE = { 1: 0.9, 2: 0.8, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.4 };

export const CATEGORY_LABEL = {
  1: "第1種（卸売業）",
  2: "第2種（小売業・農林水産業の飲食料品）",
  3: "第3種（製造業・建設業など）",
  4: "第4種（飲食店業・その他）",
  5: "第5種（運輸通信業・金融保険業・サービス業）",
  6: "第6種（不動産業）",
};

// 年分ごとの免税事業者等からの仕入れの控除割合（年の途中で変わる場合は目安）
export function defaultExemptRate(year) {
  if (year <= 2026) return 0.7; // 2026/10〜: 70%（1〜9月は80%）
  if (year === 2027) return 0.7;
  if (year === 2028) return 0.7; // 2028/10〜は50%
  if (year === 2029) return 0.5;
  if (year === 2030) return 0.5; // 2030/10〜は30%
  return 0.3;
}

const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

export function salesTax({ salesStd, salesRed }) {
  return (num(salesStd) * 10) / 110 + (num(salesRed) * 8) / 108;
}

export function purchaseTax({ purchStd, purchRed, exemptPurch, exemptRate }) {
  const rate = Math.min(Math.max(Number.isFinite(exemptRate) ? exemptRate : 0, 0), 1);
  return (
    (num(purchStd) * 10) / 110 +
    (num(purchRed) * 8) / 108 +
    (num(exemptPurch) * rate * 10) / 110
  );
}

/**
 * @param {object} i
 * @param {number} i.year 申告する年分（西暦、個人事業主の暦年）
 * @param {number} i.baseSales 基準期間（2年前）の課税売上高（税抜）
 * @param {boolean} i.registered インボイス発行事業者として登録済みか
 * @param {number} i.category 簡易課税の事業区分 1-6
 */
export function simulate(i) {
  const st = salesTax(i);
  const pt = purchaseTax(i);
  const base = num(i.baseSales);
  const results = [];

  const general = {
    key: "general",
    name: "本則課税",
    eligible: true,
    reasons: [],
    amount: Math.trunc(st - pt),
  };
  results.push(general);

  const simpleReasons = ["事前に「簡易課税制度選択届出書」の提出が必要"];
  const simpleOk = base <= 50_000_000;
  if (!simpleOk) simpleReasons.unshift("基準期間の課税売上高が5,000万円超");
  const mr = MIN_RATE[i.category] ?? MIN_RATE[5];
  results.push({
    key: "simple",
    name: `簡易課税（みなし仕入率${mr * 100}%）`,
    eligible: simpleOk,
    reasons: simpleReasons,
    amount: Math.trunc(st * (1 - mr)),
  });

  if (i.year === 2026) {
    const ok = base <= 10_000_000 && !!i.registered;
    const reasons = [];
    if (base > 10_000_000) reasons.push("基準期間の課税売上高が1,000万円超");
    if (!i.registered) reasons.push("インボイス発行事業者の登録が必要");
    results.push({ key: "twenty", name: "2割特例（売上税額の20%）", eligible: ok, reasons, amount: Math.trunc(st * 0.2) });
  } else if (i.year === 2027 || i.year === 2028) {
    const ok = base <= 10_000_000 && !!i.registered;
    const reasons = ["令和8年度税制改正に基づく個人事業者限定の措置。適用要件は国税庁の最新情報で要確認"];
    if (base > 10_000_000) reasons.unshift("基準期間の課税売上高が1,000万円超");
    if (!i.registered) reasons.unshift("インボイス発行事業者の登録が必要");
    results.push({ key: "thirty", name: "3割特例（売上税額の30%）", eligible: ok, reasons, amount: Math.trunc(st * 0.3) });
  }

  const eligible = results.filter((r) => r.eligible);
  const best = eligible.reduce((a, b) => (b.amount < a.amount ? b : a), eligible[0]);
  const purchaseRatio = st > 0 ? pt / st : 0;
  return { salesTax: Math.floor(st), purchaseTax: Math.floor(pt), results, bestKey: best.key, purchaseRatio };
}
