/* フリーランス取引条件明示ジェネレーター: 純粋ロジック (ブラウザ/Node 両対応) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TermsLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REQUIRED = [
    ['clientName', '発注事業者の名称'],
    ['freelancerName', 'フリーランス(受託者)の名称'],
    ['orderDate', '業務委託をした日'],
    ['scope', '給付(業務)の内容'],
    ['amount', '報酬の額'],
    ['paymentDate', '支払期日']
  ];

  function parseDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var p = s.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    if (d.getUTCFullYear() !== p[0] || d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) return null;
    return d;
  }

  function toIso(d) { return d.toISOString().slice(0, 10); }

  function addDays(iso, n) {
    var d = parseDate(iso);
    if (!d) return null;
    d.setUTCDate(d.getUTCDate() + n);
    return toIso(d);
  }

  function daysBetween(fromIso, toIsoStr) {
    var a = parseDate(fromIso), b = parseDate(toIsoStr);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }

  function formatYen(n) {
    return '¥' + Math.floor(n).toLocaleString('en-US');
  }

  function jpDate(iso) {
    var d = parseDate(iso);
    if (!d) return '';
    return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日';
  }

  function calcAmounts(amount, taxMode, ratePercent) {
    var a = Number(amount), r = Number(ratePercent);
    if (!isFinite(a) || a < 0 || !isFinite(r) || r < 0) return null;
    a = Math.floor(a);
    if (taxMode === 'incl') {
      var excl = Math.floor(Math.round(a * 100 * 1000) / Math.round((100 + r) * 1000));
      return { excl: excl, tax: a - excl, incl: a };
    }
    var tax = Math.floor(Math.round(a * r * 1000) / 100000);
    return { excl: a, tax: tax, incl: a + tax };
  }

  /** 60日ルール: 成果物受領日(役務提供日)から起算して60日以内の支払期日か */
  function paymentDeadlineCheck(receiptDate, paymentDate) {
    var diff = daysBetween(receiptDate, paymentDate);
    if (diff === null) return { ok: null, days: null, latest: null };
    return { ok: diff <= 60 && diff >= 0, days: diff, latest: addDays(receiptDate, 60) };
  }

  function validate(input) {
    var errors = [], warnings = [];
    input = input || {};
    REQUIRED.forEach(function (r) {
      var v = input[r[0]];
      if (v === undefined || v === null || String(v).trim() === '') errors.push(r[1] + 'は必須です');
    });
    [['orderDate', '業務委託をした日'], ['deliveryDate', '納期'], ['paymentDate', '支払期日'], ['inspectionDate', '検査完了日']].forEach(function (r) {
      if (input[r[0]] && !parseDate(input[r[0]])) errors.push(r[1] + 'の日付形式が不正です');
    });
    if (input.amount !== undefined && input.amount !== '' && !(Number(input.amount) >= 0)) {
      errors.push('報酬の額は0以上の数値で入力してください');
    }
    if (input.deliveryDate && input.paymentDate && parseDate(input.deliveryDate) && parseDate(input.paymentDate)) {
      var c = paymentDeadlineCheck(input.deliveryDate, input.paymentDate);
      if (c.days < 0) errors.push('支払期日が納期(受領日)より前になっています');
      else if (!c.ok) warnings.push('支払期日が納期から' + c.days + '日後です。受領日から60日以内(遅くとも' + jpDate(c.latest) + 'まで)に設定することが求められています。');
    } else if (input.paymentDate && !input.deliveryDate) {
      warnings.push('納期が未入力のため、60日以内ルールの確認ができません');
    }
    if (input.orderDate && input.deliveryDate && parseDate(input.orderDate) && parseDate(input.deliveryDate) &&
        daysBetween(input.orderDate, input.deliveryDate) < 0) {
      errors.push('納期が委託日より前になっています');
    }
    if (input.orderDate && input.paymentDate && parseDate(input.orderDate) && parseDate(input.paymentDate) &&
        daysBetween(input.orderDate, input.paymentDate) < 0) {
      errors.push('支払期日が業務委託をした日より前になっています');
    }
    if (input.hasInspection && !input.inspectionDate) {
      errors.push('検査(検収)を行う場合は検査完了日の入力が必要です');
    }
    if (input.paymentMethod && input.paymentMethod !== 'bank' && !String(input.paymentMethodDetail || '').trim()) {
      errors.push('現金(銀行振込)以外で支払う場合は、その方法の入力が必要です');
    }
    if (input.amount !== undefined && input.amount !== '' && Number(input.amount) >= 0) {
      if (!Number.isInteger(Number(input.amount))) errors.push('報酬の額は円単位の整数で入力してください');
      if (Number(input.amount) === 0) warnings.push('報酬の額が0円です。意図した金額か確認してください');
    }
    var rate = input.taxRate === undefined ? 10 : input.taxRate;
    if (String(rate).trim() === '' || !(Number(rate) >= 0)) errors.push('消費税率は0以上の数値で入力してください');
    if (input.deliveryDate && input.inspectionDate && input.hasInspection && parseDate(input.deliveryDate) &&
        parseDate(input.inspectionDate) && daysBetween(input.deliveryDate, input.inspectionDate) < 0) {
      warnings.push('検査完了日が納期より前になっています');
    }
    return { errors: errors, warnings: warnings };
  }

  function buildDocument(input) {
    var amt = calcAmounts(input.amount, input.taxMode || 'excl', input.taxRate === undefined ? 10 : input.taxRate);
    var L = [];
    L.push('取 引 条 件 明 示 書');
    L.push('');
    L.push('作成日: ' + (jpDate(input.orderDate) || '(未入力)'));
    L.push('');
    L.push('発注事業者: ' + input.clientName + (input.clientContact ? '(連絡先: ' + input.clientContact + ')' : ''));
    L.push('受託者(フリーランス): ' + input.freelancerName + (input.freelancerContact ? '(連絡先: ' + input.freelancerContact + ')' : ''));
    L.push('');
    L.push('下記のとおり、業務を委託します。');
    L.push('');
    L.push('1. 業務委託をした日: ' + jpDate(input.orderDate));
    L.push('2. 給付(業務)の内容: ' + input.scope);
    if (input.deliverable) L.push('   成果物: ' + input.deliverable);
    L.push('3. 納期(給付の提供期日): ' + (jpDate(input.deliveryDate) || '別途協議のうえ定める'));
    L.push('4. 給付の提供場所: ' + (input.place || '電子データでの納品(メール/オンラインストレージ等)'));
    if (input.hasInspection) L.push('5. 検査(検収)完了日: ' + jpDate(input.inspectionDate));
    else L.push('5. 検査(検収): 行わない');
    if (amt) {
      L.push('6. 報酬の額: ' + formatYen(amt.excl) + '(税抜) + 消費税 ' + formatYen(amt.tax) + ' = ' + formatYen(amt.incl) + '(税込)');
    }
    if (input.amountNote) L.push('   報酬の算定方法・備考: ' + input.amountNote);
    L.push('7. 支払期日: ' + jpDate(input.paymentDate));
    var pm = input.paymentMethod === 'bank' || !input.paymentMethod ? '銀行振込' : input.paymentMethodDetail;
    L.push('8. 支払方法: ' + pm);
    if (input.transferFeeBy) L.push('   振込手数料: ' + (input.transferFeeBy === 'client' ? '発注事業者負担' : '受託者負担'));
    if (input.ipTerms) L.push('9. 知的財産権の取扱い: ' + input.ipTerms);
    L.push('');
    L.push('※ 本書は、特定受託事業者に係る取引の適正化等に関する法律(フリーランス・事業者間取引適正化等法)第3条に定める');
    L.push('  取引条件の明示を目的としたひな形です。法的助言ではありません。');
    return L.join('\n');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  return { parseDate: parseDate, addDays: addDays, daysBetween: daysBetween, formatYen: formatYen,
    jpDate: jpDate, calcAmounts: calcAmounts, paymentDeadlineCheck: paymentDeadlineCheck,
    validate: validate, buildDocument: buildDocument, escapeHtml: escapeHtml };
});
