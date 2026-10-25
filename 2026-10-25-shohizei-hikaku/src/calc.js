// 消費税 納税額の比較ロジック(個人事業主・単一事業区分・標準税率10%/軽減税率8%)
// 税率・特例の割合は定数にまとめ、税制改正時はここだけ直す。

export const DEEMED_RATES = {
  1: { label: '第一種(卸売業)', rate: 0.9 },
  2: { label: '第二種(小売業・農林水産業[飲食料品])', rate: 0.8 },
  3: { label: '第三種(製造業・建設業など)', rate: 0.7 },
  4: { label: '第四種(飲食店業・その他)', rate: 0.6 },
  5: { label: '第五種(サービス業・運輸通信業など)', rate: 0.5 },
  6: { label: '第六種(不動産業)', rate: 0.4 },
};

// 特例の納付割合(売上税額に対する割合)。税制改正で変わりうるため要確認。
export const SPECIAL_RATIO = { twenty: 0.2, thirty: 0.3 };

// 負値・非数は0、桁あふれ防止のため1兆円で上限
export const MAX_AMOUNT = 1_000_000_000_000;
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(Number(v), MAX_AMOUNT) : 0);

/** 税込金額から含まれる消費税(国税+地方税の合計税率ベース)を求める */
export function taxIncluded(amount10, amount8) {
  return Math.floor(num(amount10) * 10 / 110) + Math.floor(num(amount8) * 8 / 108);
}

/** 税額(合計税率ベース)を国税78/100と地方消費税(国税の22/78)に分ける。国税は100円未満切捨て。 */
export function split(taxTotal) {
  const national = Math.floor(Math.floor(taxTotal * 78 / 100) / 100) * 100;
  const local = Math.floor(Math.floor(national * 22 / 78) / 100) * 100;
  return { national, local, total: national + local };
}

/**
 * @param {object} i
 *  sales10, sales8: 課税売上(税込)  purchase10, purchase8: 適格請求書のある課税仕入(税込)
 *  category: 1..6  eligible: { twenty, thirty, simplified } の可否
 */
export function compare(i) {
  const salesTax = taxIncluded(i.sales10, i.sales8);
  const purchaseTax = taxIncluded(i.purchase10, i.purchase8);
  const rate = DEEMED_RATES[i.category]?.rate ?? 0.5;
  const el = i.eligible ?? {};

  const results = [];
  // 原則課税: 還付(マイナス)もあり得る
  results.push({ key: 'general', label: '原則課税', eligible: true, tax: salesTax - purchaseTax });
  results.push({
    key: 'simplified', label: `簡易課税(みなし仕入率${rate * 100}%)`, eligible: !!el.simplified,
    tax: salesTax - Math.floor(salesTax * rate),
  });
  results.push({
    key: 'twenty', label: '2割特例', eligible: !!el.twenty,
    tax: Math.floor(salesTax * SPECIAL_RATIO.twenty),
  });
  results.push({
    key: 'thirty', label: '3割特例', eligible: !!el.thirty,
    tax: Math.floor(salesTax * SPECIAL_RATIO.thirty),
  });

  for (const r of results) {
    // 納付税額は国税100円未満切捨て後に地方消費税を算出(中間納付等は考慮しない)。還付は端数処理しない。
    r.tax = r.tax >= 0 ? split(r.tax).total : r.tax;
    r.refund = r.tax < 0;
  }
  const candidates = results.filter((r) => r.eligible);
  const best = candidates.reduce((a, b) => (b.tax < a.tax ? b : a), candidates[0]);
  return { salesTax, purchaseTax, results, bestKey: best.key };
}

/** 課税仕入率(売上に対する仕入の割合)を変えたときの各方式の納税額表 */
export function sensitivity(base, ratios = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
  const total10 = num(base.sales10), total8 = num(base.sales8);
  return ratios.map((p) => {
    const r = compare({
      ...base,
      purchase10: Math.floor(total10 * p),
      purchase8: Math.floor(total8 * p),
    });
    return { ratio: p, results: r.results, bestKey: r.bestKey };
  });
}

/** 届出・申告に関する日付チェックリスト(要・国税庁サイトでの最終確認) */
export function checklist(year = 2026) {
  return [
    `令和${year - 2018}年分(${year}年分)の確定申告期限までに、簡易課税制度選択届出書の提出が必要か確認する`,
    '原則課税を選ぶ場合は届出不要。簡易課税は2年間継続が原則(やめる場合は不適用届出書)',
    '2割特例・3割特例は届出不要で、申告書に適用の旨を記載して適用する(令和9年分以降の取扱いは国税庁の最新情報で確認)',
    '基準期間(2年前)の課税売上高が1,000万円超の場合、2割・3割特例は使えない可能性がある',
    '基準期間の課税売上高が5,000万円超の場合、簡易課税は使えない',
  ];
}
