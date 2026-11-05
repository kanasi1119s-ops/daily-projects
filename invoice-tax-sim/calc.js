/* 消費税 課税方式比較ロジック (UMD)。税率10%のみ対応。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TaxCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var DEEMED = { 1: 0.9, 2: 0.8, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.4 };
  var SIMPLIFIED_LIMIT = 50000000; // 簡易課税: 基準期間の課税売上高上限
  var MAX_AMOUNT = 1e13; // 入力上限(10兆円)
  var TWENTY_BASE_LIMIT = 10000000; // 2割特例: 免税事業者(基準期間1,000万円以下)が対象

  // 全角数字・カンマ・空白・円記号を除去して数値化。不正なら NaN
  function parseAmount(v) {
    var s = String(v == null ? '' : v).replace(/[０-９]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); });
    s = s.replace(/[,，\s円¥￥]/g, '');
    if (s === '') return 0;
    if (!/^\d+$/.test(s)) return NaN; // 小数・負数・文字は不可
    var n = Number(s);
    return n <= MAX_AMOUNT ? n : NaN;
  }

  function toAmount(v) {
    var n = typeof v === 'string' ? parseAmount(v) : Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  // 税込金額から消費税額(10/110)を切り捨てで算出
  function taxPortion(taxIncluded) {
    return Math.floor((toAmount(taxIncluded) * 10) / 110);
  }

  /**
   * input: { sales(税込課税売上), purchases(税込・適格請求書のある課税仕入),
   *          baseSales(基準期間の課税売上高・税抜), category(1-6),
   *          twentyEligible(bool) }
   */
  function simulate(input) {
    var sales = toAmount(input.sales);
    var purchases = toAmount(input.purchases);
    var baseSales = toAmount(input.baseSales);
    var category = DEEMED[input.category] ? Number(input.category) : 5;
    var salesTax = taxPortion(sales);
    var purchaseTax = taxPortion(purchases);
    var results = [];

    var honsoku = salesTax - purchaseTax; // 負の値は還付見込
    var refund = honsoku < 0 ? -honsoku : 0;
    results.push({ key: 'honsoku', label: '本則課税', available: true, tax: honsoku, refund: refund, note: refund > 0 ? '仕入税額が上回るため還付見込(マイナス表示。実際の還付可否は要確認)' : '' });

    var rate = DEEMED[category];
    var simpAvail = baseSales <= SIMPLIFIED_LIMIT;
    var simpTax = Math.floor(salesTax * (1 - rate));
    results.push({ key: 'simplified', label: '簡易課税(第' + category + '種 みなし仕入率' + Math.round(rate * 100) + '%)', available: simpAvail, tax: simpTax, refund: 0, note: simpAvail ? '事前の届出が必要' : '基準期間の課税売上高が5,000万円超のため利用不可' });

    var twentyAvail = !!input.twentyEligible && baseSales <= TWENTY_BASE_LIMIT;
    results.push({ key: 'twenty', label: '2割特例', available: twentyAvail, tax: Math.floor(salesTax * 0.2), refund: 0, note: twentyAvail ? '令和8年(2026年)9月30日を含む課税期間までの特例。個人事業主は2026年分が最後' : '対象外として除外(基準期間の課税売上高が1,000万円超、または対象期間外)' });

    var best = null;
    results.forEach(function (r) { if (r.available && (best === null || r.tax < best.tax)) best = r; });
    return { salesTax: salesTax, purchaseTax: purchaseTax, results: results, best: best ? best.key : null };
  }

  return { parseAmount: parseAmount, simulate: simulate, taxPortion: taxPortion, toAmount: toAmount, DEEMED: DEEMED, SIMPLIFIED_LIMIT: SIMPLIFIED_LIMIT };
});
