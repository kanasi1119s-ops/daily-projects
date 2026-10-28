// 発注書(取引条件明示書面)ジェネレーターのロジック。DOM非依存。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrderSheet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY_MS = 86400000;

  function parseDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    if (d.getUTCFullYear() !== p[0] || d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) return null;
    return d;
  }

  function diffDays(from, to) {
    return Math.round((to.getTime() - from.getTime()) / DAY_MS);
  }

  function formatDate(s) {
    var d = parseDate(s);
    if (!d) return '';
    return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日';
  }

  function formatYen(n) {
    return Number(n).toLocaleString('en-US') + '円';
  }

  function blank(v) {
    return v == null || String(v).trim() === '';
  }

  // 戻り値: { errors: [{field,message}], warnings: [{field,message}] }
  function validate(f) {
    var errors = [];
    var warnings = [];
    function err(field, message) { errors.push({ field: field, message: message }); }
    function warn(field, message) { warnings.push({ field: field, message: message }); }

    if (blank(f.clientName)) err('clientName', '発注者(業務委託事業者)の名称を入力してください。');
    if (blank(f.freelancerName)) err('freelancerName', '受注者(フリーランス)の名称を入力してください。');
    if (blank(f.workContent)) err('workContent', '業務(給付)の内容を入力してください。');
    if (blank(f.deliveryPlace)) err('deliveryPlace', '納品(提供)場所を入力してください。');

    var order = parseDate(f.orderDate);
    var delivery = parseDate(f.deliveryDate);
    var payment = parseDate(f.paymentDate);
    if (!order) err('orderDate', '発注日を正しい日付で入力してください。');
    if (!delivery) err('deliveryDate', '納期(給付を受領する期日)を正しい日付で入力してください。');
    if (!payment) err('paymentDate', '支払期日を正しい日付で入力してください。');

    if (order && delivery && delivery < order) {
      warn('deliveryDate', '納期が発注日より前になっています。');
    }
    if (delivery && payment) {
      var d = diffDays(delivery, payment);
      if (d > 60) {
        warn('paymentDate', '支払期日が納期から' + d + '日後です。フリーランス法では、給付を受領した日から起算して60日以内のできる限り短い期間内に支払期日を定める必要があります(要確認)。');
      }
    }

    if (f.feeType === 'method') {
      if (blank(f.feeMethod)) err('feeMethod', '報酬額を算定する方法を入力してください。');
    } else {
      var amt = Number(f.feeAmount);
      if (blank(f.feeAmount) || !Number.isInteger(amt) || amt <= 0 || amt > 1e12) {
        err('feeAmount', '報酬額は1以上1兆以下の整数(円)で入力してください。');
      }
    }

    if (f.hasInspection) {
      if (!parseDate(f.inspectionDate)) err('inspectionDate', '検査を行う場合は検査完了日を正しい日付で入力してください。');
      else if (delivery && parseDate(f.inspectionDate) < delivery) warn('inspectionDate', '検査完了日が納期より前になっています。');
    }

    if (f.paymentMethod === 'other' && blank(f.paymentMethodDetail)) {
      err('paymentMethodDetail', '現金以外の方法で支払う場合は、その方法に関する事項を入力してください。');
    }

    return { errors: errors, warnings: warnings };
  }

  function generate(f) {
    var L = [];
    var fee = f.feeType === 'method'
      ? '算定方法: ' + String(f.feeMethod).trim()
      : formatYen(f.feeAmount) + (f.taxIncluded ? '(消費税込)' : '(消費税別)');
    var pay = f.paymentMethod === 'other'
      ? String(f.paymentMethodDetail).trim()
      : '銀行振込';

    L.push('発 注 書(取引条件の明示)');
    L.push('');
    L.push('発注日: ' + formatDate(f.orderDate));
    L.push('');
    L.push('【業務委託事業者(発注者)】 ' + String(f.clientName).trim());
    L.push('【フリーランス(受注者)】 ' + String(f.freelancerName).trim());
    L.push('');
    L.push('1. 業務(給付)の内容');
    L.push(String(f.workContent).trim());
    L.push('');
    L.push('2. 納期(給付を受領する期日/役務の提供を受ける期日): ' + formatDate(f.deliveryDate));
    L.push('3. 納品(提供)場所: ' + String(f.deliveryPlace).trim());
    if (f.hasInspection) L.push('4. 検査完了日: ' + formatDate(f.inspectionDate));
    else L.push('4. 検査: 行わない');
    L.push('5. 報酬の額: ' + fee);
    L.push('6. 支払期日: ' + formatDate(f.paymentDate));
    L.push('7. 支払方法: ' + pay);
    if (!blank(f.notes)) {
      L.push('');
      L.push('備考');
      L.push(String(f.notes).trim());
    }
    L.push('');
    L.push('※ 本書面は入力内容をもとに自動生成した雛形です。法的助言ではありません。');
    return L.join('\n');
  }

  return { parseDate: parseDate, diffDays: diffDays, formatDate: formatDate, formatYen: formatYen, validate: validate, generate: generate };
});
