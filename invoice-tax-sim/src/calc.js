(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TaxCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var RATE = 0.1; // 消費税(国税7.8%)+地方消費税(2.2%) の合計。標準税率のみ対応
  var DEEMED = { 1: 0.9, 2: 0.8, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.4 };
  var LABELS = {
    1: '第1種 卸売業', 2: '第2種 小売業', 3: '第3種 製造業等',
    4: '第4種 その他', 5: '第5種 サービス業等', 6: '第6種 不動産業'
  };

  function floorYen(n) { return Math.floor(n + 1e-9); }

  var MAX = 1e13;
  // 文字列は10進数のみ許可（'0x10' や '1e3' を弾く）
  function toNum(v) {
    if (typeof v === 'string') return /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
    return Number(v);
  }

  function validate(input) {
    var s = toNum(input.sales), p = toNum(input.purchases);
    if (!isFinite(s) || s < 0 || s > MAX) return '課税売上は0以上10兆円以下の数値で入力してください';
    if (!isFinite(p) || p < 0 || p > MAX) return '課税仕入は0以上の数値で入力してください';
    if (!DEEMED[input.category]) return '事業区分が不正です';
    return null;
  }

  // sales / purchases: 税抜年額(円)。period: 'upto2026' | 'from2027'
  function compare(input) {
    var err = validate(input);
    if (err) return { error: err };
    var s = Math.floor(toNum(input.sales)), p = Math.floor(toNum(input.purchases));
    var cat = Number(input.category);
    var results = [];

    results.push({ key: 'exempt', name: '免税事業者のまま', tax: 0, available: true,
      note: '納税なし。ただしインボイス不要の取引先が前提です。' });

    var honsoku = floorYen(s * RATE) - floorYen(p * RATE);
    results.push({ key: 'honsoku', name: '課税事業者（本則課税）', tax: honsoku, available: true,
      note: honsoku < 0 ? 'マイナスは還付見込みを表します。' : '実際の課税仕入に基づく計算です。' });

    var simple = floorYen(s * RATE * (1 - DEEMED[cat]));
    var simpleOk = s <= 50000000;
    results.push({ key: 'simple', name: '課税事業者（簡易課税）', tax: simple, available: simpleOk,
      note: simpleOk ? '事前の届出が必要です。みなし仕入率 ' + DEEMED[cat] * 100 + '%（' + LABELS[cat] + '）。'
                     : '課税売上5,000万円超のため利用できない見込みです。' });

    var twenty = input.period !== 'from2027';
    results.push({ key: 'twenty', name: '課税事業者（2割特例）', tax: floorYen(s * RATE * 0.2), available: twenty,
      note: twenty ? 'インボイス登録で免税から課税になった事業者向けの経過措置です。基準期間の課税売上1,000万円以下などの要件があり、適用可否は国税庁で要確認。'
                   : '経過措置の対象期間外（2027年以降の課税期間）として扱っています。' });

    results.forEach(function (r) { r.takeHome = s - p - r.tax; });
    var avail = results.filter(function (r) { return r.available && r.key !== 'exempt'; });
    var best = avail.reduce(function (a, b) { return b.tax < a.tax ? b : a; }, avail[0]);
    return { results: results, best: best.key };
  }

  return { compare: compare, RATE: RATE, DEEMED: DEEMED, LABELS: LABELS };
});
