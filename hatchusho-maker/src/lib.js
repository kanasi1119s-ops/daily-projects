// 発注書メーカー: ロジック(DOM非依存)。ブラウザ/Node両対応。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HatchuLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // フリーランス新法 第3条 に基づく明示事項(公取委・中企庁の資料を基にした実装用の項目リスト。最終確認は一次情報で)
  var REQUIRED = [
    ['clientName', '発注事業者の名称'],
    ['freelancerName', 'フリーランスの名称'],
    ['orderDate', '業務委託をした日'],
    ['workDescription', '業務(給付)の内容'],
    ['deliveryDate', '納期(給付を受領/役務提供を受ける日)'],
    ['deliveryPlace', '納品場所(給付を受領/役務提供を受ける場所)'],
    ['paymentDueDate', '報酬の支払期日']
  ];

  function isValidDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  function daysBetween(a, b) {
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  }

  function parseAmount(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (typeof v !== 'string') return NaN;
    var s = v.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
             .replace(/[,，円¥\s]/g, '');
    if (s === '' || !/^\d+$/.test(s)) return NaN;
    return Number(s);
  }

  // 数量用: 小数可(例 1.5時間)
  function parseQty(v) {
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? v : NaN;
    if (typeof v !== 'string') return NaN;
    var s = v.replace(/[０-９．]/g, function (c) { return c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }).replace(/[,，\s]/g, '');
    return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }

  function formatYen(n) {
    return '¥' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatDate(s) {
    if (!isValidDate(s)) return '';
    var p = s.split('-');
    return p[0] + '年' + Number(p[1]) + '月' + Number(p[2]) + '日';
  }

  // items: [{name, qty, unitPrice}] -> 小計・消費税(10%/端数切捨)・合計
  function calcTotals(items, taxRate) {
    var rate = typeof taxRate === 'number' ? taxRate : 0.1;
    var subtotal = 0, rows = [];
    (items || []).forEach(function (it) {
      var qty = parseQty(it.qty), price = parseAmount(it.unitPrice);
      if (String(it.name || '').trim() === '' && isNaN(qty) && isNaN(price)) return; // 空行は無視
      var amount = (isNaN(qty) || isNaN(price)) ? 0 : Math.floor(qty * price);
      rows.push({ bad: isNaN(qty) || isNaN(price), name: it.name || '', qty: isNaN(qty) ? 0 : qty, unitPrice: isNaN(price) ? 0 : price, amount: amount });
      subtotal += amount;
    });
    var tax = Math.floor(subtotal * rate);
    return { rows: rows, subtotal: subtotal, tax: tax, total: subtotal + tax };
  }

  // 検証: {errors:[], warnings:[]}
  function validate(d) {
    var errors = [], warnings = [];
    REQUIRED.forEach(function (r) {
      if (!String(d[r[0]] == null ? '' : d[r[0]]).trim()) errors.push(r[1] + 'が未入力です');
    });
    var DL = { orderDate: '発注日', deliveryDate: '納期', paymentDueDate: '支払期日', inspectionDate: '検査完了日' };
    Object.keys(DL).forEach(function (k) {
      if (d[k] && !isValidDate(d[k])) errors.push(DL[k] + 'の日付が不正です');
    });
    var t = calcTotals(d.items, d.taxRate);
    if (t.rows.length === 0) errors.push('報酬の明細が1行もありません');
    else if (t.rows.some(function (r) { return !r.name.trim(); })) errors.push('品目名が空の明細があります');
    else if (t.rows.some(function (r) { return r.bad; })) errors.push('数量または単価が不正な明細があります(数字で入力してください)');
    else if (!isFinite(t.total) || t.total > 1e12) errors.push('報酬の額が大きすぎます(上限1兆円)')
    else if (t.total <= 0) errors.push('報酬の額が0円です(額を算定できない場合は算定方法を記載してください)');
    if (isValidDate(d.orderDate) && isValidDate(d.deliveryDate) && d.deliveryDate < d.orderDate)
      errors.push('納期が発注日より前です');
    if (isValidDate(d.deliveryDate) && isValidDate(d.paymentDueDate)) {
      if (d.paymentDueDate < d.deliveryDate) errors.push('支払期日が納期より前です');
      var days = daysBetween(d.deliveryDate, d.paymentDueDate);
      // 新法: 受領日から60日以内のできる限り短い期間内で設定する義務
      if (days > 60) warnings.push('支払期日が納期(受領日)から' + days + '日後です。フリーランス新法では原則、受領日から60日以内の期日設定が求められます(要確認)');
    }
    if (d.hasInspection && !isValidDate(d.inspectionDate)) errors.push('検査がある場合は検査完了日を入力してください');
    if (d.hasInspection && isValidDate(d.inspectionDate) && isValidDate(d.deliveryDate) && d.inspectionDate < d.deliveryDate)
      errors.push('検査完了日が納期より前です');
    if (d.paymentMethod && d.paymentMethod !== 'cash' && !String(d.paymentMethodNote || '').trim())
      errors.push('現金以外で支払う場合は方法の詳細を入力してください');
    if (d.clientInvoiceNo && !/^T\d{13}$/.test(d.clientInvoiceNo)) warnings.push('登録番号は「T」+13桁の数字で入力してください');
    return { errors: errors, warnings: warnings };
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nl2br(s) { return esc(s).replace(/\r?\n/g, '<br>'); }

  // 発注書HTML(印刷/PDF保存用)。すべてエスケープ済み。
  function renderDocument(d) {
    var t = calcTotals(d.items, d.taxRate);
    var pm = d.paymentMethod === 'cash' || !d.paymentMethod ? '金融機関への振込(現金)' : esc(d.paymentMethodNote);
    var h = '<h1>発注書(取引条件明示書)</h1>';
    h += '<p class="r">発注日: ' + esc(formatDate(d.orderDate)) + '</p>';
    h += '<p><b>' + esc(d.freelancerName) + '</b> 御中</p>';
    h += '<p class="r">発注事業者: ' + esc(d.clientName) + '<br>' + nl2br(d.clientAddress) +
         (d.clientInvoiceNo ? '<br>登録番号: ' + esc(d.clientInvoiceNo) : '') + '</p>';
    h += '<table><tr><th>品目</th><th>数量</th><th>単価</th><th>金額</th></tr>';
    t.rows.forEach(function (r) {
      h += '<tr><td>' + esc(r.name) + '</td><td class="n">' + r.qty + '</td><td class="n">' + formatYen(r.unitPrice) +
           '</td><td class="n">' + formatYen(r.amount) + '</td></tr>';
    });
    h += '<tr><td colspan="3" class="n">小計</td><td class="n">' + formatYen(t.subtotal) + '</td></tr>';
    h += '<tr><td colspan="3" class="n">消費税(' + Math.round((d.taxRate == null ? 0.1 : d.taxRate) * 100) + '%)</td><td class="n">' + formatYen(t.tax) + '</td></tr>';
    h += '<tr><td colspan="3" class="n"><b>合計(報酬の額)</b></td><td class="n"><b>' + formatYen(t.total) + '</b></td></tr></table>';
    h += '<table class="kv">';
    function row(k, v) { h += '<tr><th>' + k + '</th><td>' + v + '</td></tr>'; }
    row('業務の内容', nl2br(d.workDescription));
    row('納期', esc(formatDate(d.deliveryDate)));
    row('納品場所', esc(d.deliveryPlace));
    if (d.hasInspection) row('検査完了日', esc(formatDate(d.inspectionDate)));
    row('報酬の支払期日', esc(formatDate(d.paymentDueDate)));
    row('支払方法', pm);
    if (d.notes) row('その他の取引条件', nl2br(d.notes));
    h += '</table>';
    h += '<p class="s">本書は、特定受託事業者に係る取引の適正化等に関する法律に基づく取引条件の明示を目的として作成されたものです。</p>';
    return h;
  }

  return { REQUIRED: REQUIRED, isValidDate: isValidDate, daysBetween: daysBetween, parseAmount: parseAmount,
           formatYen: formatYen, formatDate: formatDate, calcTotals: calcTotals, parseQty: parseQty, validate: validate,
           renderDocument: renderDocument, esc: esc };
});
