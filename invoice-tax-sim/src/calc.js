/**
 * 消費税シミュレーション用の純粋関数群。
 * 税制は改正されるため、税率・みなし仕入率・経過措置控除率は引数で上書き可能にしている。
 * 本ツールは概算であり、税務判断は国税庁の公式情報・税理士で確認すること。
 */

export const DEFAULT_RATE = 0.1;

/** 簡易課税のみなし仕入率(事業区分 第1〜6種) */
export const DEEMED_PURCHASE_RATES = {
  1: 0.9, // 卸売業
  2: 0.8, // 小売業・農林漁業(飲食料品)
  3: 0.7, // 製造業等
  4: 0.6, // その他(飲食店等)
  5: 0.5, // サービス業等(ITコンサル・デザイン・執筆など)
  6: 0.4, // 不動産業
};

/** 非適格請求書(免税事業者等)からの仕入れの経過措置控除率。改正され得るため要確認。 */
export function transitionalCreditRate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const t = d.getTime();
  if (Number.isNaN(t)) throw new RangeError("invalid date");
  if (t < Date.UTC(2023, 9, 1)) return 1; // 制度開始前は全額控除
  if (t < Date.UTC(2026, 9, 1)) return 0.8;
  if (t < Date.UTC(2029, 9, 1)) return 0.5;
  return 0;
}

export const MAX_YEN = 1e12; // 入力上限(1兆円)。桁あふれによる誤表示の防止

function assertYen(label, v) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > MAX_YEN) {
    throw new RangeError(`${label}は0円以上1兆円以下の数値で入力してください`);
  }
}

/**
 * @param {object} input
 * @param {number} input.sales 課税売上(税込・円)
 * @param {number} input.purchases 課税仕入れ・経費(税込・円)
 * @param {number} [input.nonQualifiedRatio=0] 仕入れのうち非適格(免税業者等)の割合 0〜1
 * @param {number} [input.businessType=5] 簡易課税の事業区分 1〜6
 * @param {number} [input.rate=0.1] 消費税率(地方消費税を含む)
 * @param {number} [input.creditRate] 非適格仕入れの控除率(省略時は asOf から算出)
 * @param {Date|string} [input.asOf] 基準日
 * @param {boolean} [input.twoTenthsEligible=true] 2割特例を使える前提か
 */
export function simulate(input) {
  const {
    sales,
    purchases,
    nonQualifiedRatio = 0,
    businessType = 5,
    rate = DEFAULT_RATE,
    asOf = new Date(),
    twoTenthsEligible = true,
  } = input;
  assertYen("課税売上", sales);
  assertYen("課税仕入れ・経費", purchases);
  if (!(rate >= 0 && rate <= 1)) throw new RangeError("税率は0〜1で指定してください");
  if (!(nonQualifiedRatio >= 0 && nonQualifiedRatio <= 1)) {
    throw new RangeError("非適格の割合は0〜100%で入力してください");
  }
  const deemed = DEEMED_PURCHASE_RATES[businessType];
  if (deemed === undefined) throw new RangeError("事業区分は第1〜6種から選択してください");
  const creditRate = input.creditRate ?? transitionalCreditRate(asOf);
  if (!(creditRate >= 0 && creditRate <= 1)) throw new RangeError("控除率は0〜1で指定してください");

  // 浮動小数点誤差を避けるため、円・税率(%)の整数で計算する
  const pct = Math.round(rate * 100);
  const taxOf = (gross) => Math.floor((gross * pct) / (100 + pct));
  const salesYen = Math.round(sales);
  const purchasesYen = Math.round(purchases);
  const outputTax = taxOf(salesYen);
  const netSales = salesYen - outputTax;
  const nonQualified = Math.round(purchasesYen * nonQualifiedRatio);
  const qualified = purchasesYen - nonQualified;
  const inputTax = taxOf(qualified) + Math.floor(taxOf(nonQualified) * creditRate + 1e-9);

  const honsokuRaw = outputTax - inputTax; // 負なら還付
  const honsoku = Math.max(0, honsokuRaw);
  const simplified = Math.floor(outputTax * (1 - deemed) + 1e-9);
  const twoTenths = twoTenthsEligible ? Math.floor(outputTax * 0.2 + 1e-9) : null;

  // 納付額は100円未満切捨て(申告納付額)
  const pay = (n) => (n === null ? null : Math.floor(n / 100) * 100);
  const methods = {
    honsoku: { label: "本則課税", tax: pay(honsoku) },
    simplified: { label: `簡易課税(第${businessType}種)`, tax: pay(simplified) },
    twoTenths: { label: "2割特例", tax: pay(twoTenths) },
  };
  const candidates = Object.entries(methods).filter(([, m]) => m.tax !== null);
  const best = candidates.reduce((a, b) => (b[1].tax < a[1].tax ? b : a))[0];

  return {
    outputTax,
    inputTax,
    netSales,
    creditRate,
    methods,
    best,
    monthlyReserve: Math.ceil(methods[best].tax / 12),
    // 登録しない場合(免税): 取引先への影響は別途検討
    refund: Math.max(0, -honsokuRaw), // 本則課税での還付見込み(要還付申告)
    exemptTax: 0,
  };
}
