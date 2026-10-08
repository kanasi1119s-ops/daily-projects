// フリーランス新法 取引条件チェッカー: コアロジック（DOM非依存・外部依存なし）
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FLCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 法第3条: 書面等で明示すべき事項
  var REQUIRED_ITEMS = [
    { key: 'client', label: '発注事業者の名称', field: 'clientName' },
    { key: 'freelancer', label: 'フリーランスの名称（氏名）', field: 'freelancerName' },
    { key: 'orderDate', label: '業務委託をした日', field: 'orderDate' },
    { key: 'content', label: '給付（業務）の内容', field: 'content' },
    { key: 'deliveryDate', label: '給付を受領／役務提供を受ける期日', field: 'deliveryDate' },
    { key: 'place', label: '給付を受領／役務提供を受ける場所', field: 'place' },
    { key: 'reward', label: '報酬の額（算定方法でも可・要件あり）', field: 'reward' },
    { key: 'payDate', label: '報酬の支払期日', field: 'payDate' },
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
    return d;
  }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }

  // 受領日を1日目として数えた60日目（保守的な上限）。
  function deadline60(receiptStr) {
    var d = parse(receiptStr);
    if (!d) return null;
    return fmt(addDays(d, 59));
  }

  // 受領日から見た「2か月以内」運用の上限（受領月+2か月の応当日の前日、無ければ月末）。
  // 例: 1/31受領 → 3/30 ではなく、保守的に60日ルールと小さい方を採用する用途で使う。
  function deadlineTwoMonths(receiptStr) {
    var d = parse(receiptStr);
    if (!d) return null;
    var y = d.getFullYear(), m = d.getMonth() + 2;
    var ty = y + Math.floor(m / 12), tm = m % 12;
    var day = Math.min(d.getDate(), daysInMonth(ty, tm));
    return fmt(addDays(new Date(ty, tm, day), -1));
  }

  // 支払日ルールから実際の支払日を求める。
  // rule: { closingDay: 1-31 | 'end', payMonthOffset: 1|2|3.., payDay: 1-31 | 'end' }
  function resolveDay(y, m0, day) {
    var last = daysInMonth(y, m0);
    return day === 'end' ? last : Math.min(+day, last);
  }
  function paymentDateFor(receiptStr, rule) {
    var d = parse(receiptStr);
    if (!d) return null;
    var y = d.getFullYear(), m0 = d.getMonth();
    var closing = resolveDay(y, m0, rule.closingDay);
    // 締め日より後に受領した分は翌月締め扱い
    var closeMonthShift = d.getDate() > closing ? 1 : 0;
    var t = m0 + closeMonthShift + rule.payMonthOffset;
    var py = y + Math.floor(t / 12), pm = ((t % 12) + 12) % 12;
    return fmt(new Date(py, pm, resolveDay(py, pm, rule.payDay)));
  }

  // 支払日が許容範囲か: 60日以内、または「2か月以内」運用の範囲内
  function withinLimit(receiptStr, payStr) {
    if (diffDaysInclusive(receiptStr, payStr) <= 60) return true;
    return payStr <= deadlineTwoMonths(receiptStr);
  }

  function diffDaysInclusive(fromStr, toStr) {
    var a = parse(fromStr), b = parse(toStr);
    return Math.round((b - a) / 86400000) + 1; // 受領日を1日目とする
  }

  // 受領日が month 内の全日であったときの最悪ケースを検証する。
  function verifyPaymentRule(rule, year, month1) {
    var n = daysInMonth(year, month1 - 1), worst = null, worstViolation = null, violations = 0;
    for (var day = 1; day <= n; day++) {
      var r = year + '-' + pad(month1) + '-' + pad(day);
      var p = paymentDateFor(r, rule);
      var elapsed = diffDaysInclusive(r, p);
      if (!worst || (elapsed > worst.elapsed)) worst = { receipt: r, payment: p, elapsed: elapsed };
      if (!withinLimit(r, p)) {
        violations++;
        if (!worstViolation || elapsed > worstViolation.elapsed) worstViolation = { receipt: r, payment: p, elapsed: elapsed };
      }
    }
    return { ok: violations === 0, violations: violations, daysChecked: n, worst: worst, worstViolation: worstViolation };
  }

  // 12か月分を検証（年内の月ごとの日数差を拾う）
  function verifyPaymentRuleYear(rule, year) {
    var res = [], ok = true, worst = null;
    for (var m = 1; m <= 12; m++) {
      var v = verifyPaymentRule(rule, year, m);
      if (!v.ok) ok = false;
      if (!worst || v.worst.elapsed > worst.elapsed) worst = v.worst;
      res.push({ month: m, ok: v.ok, violations: v.violations, worst: v.worst, worstViolation: v.worstViolation });
    }
    return { ok: ok, worst: worst, months: res };
  }

  // 第3条の明示事項チェック
  function checkTerms(input) {
    var missing = [], warnings = [];
    REQUIRED_ITEMS.forEach(function (it) {
      var v = input[it.field];
      if (v == null || String(v).trim() === '') missing.push(it.label);
    });
    if (input.orderDate && !parse(input.orderDate)) warnings.push('業務委託日の形式が不正です（YYYY-MM-DD）。');
    if (input.deliveryDate && !parse(input.deliveryDate)) warnings.push('受領期日の形式が不正です（YYYY-MM-DD）。');
    if (input.payDate && parse(input.payDate) && parse(input.deliveryDate)) {
      var el = diffDaysInclusive(input.deliveryDate, input.payDate);
      if (!withinLimit(input.deliveryDate, input.payDate)) warnings.push('支払期日が受領日から60日（2か月以内運用を含む）を超えています: ' + el + '日。');
      if (el < 1) warnings.push('支払期日が受領日より前になっています。');
    } else if (input.payDate && !parse(input.payDate)) {
      warnings.push('支払期日は具体的な日付で指定してください（「納品後60日以内」等の曖昧な記載は避ける）。');
    }
    if (input.payDate && parse(input.payDate) && parse(input.orderDate) && parse(input.payDate) < parse(input.orderDate))
      warnings.push('支払期日が業務委託日より前になっています。');
    if (input.rewardUndetermined && !String(input.rewardMethod || '').trim())
      warnings.push('報酬額が確定できない場合は、算定方法の明示が必要です。');
    if (input.nonCash && !String(input.nonCashMethod || '').trim())
      warnings.push('現金以外の方法で支払う場合は、その方法の明示が必要です。');
    if (input.inspection && !String(input.inspectionDate || '').trim())
      warnings.push('検査を行う場合は、検査完了日の明示が必要です。');
    return { ok: missing.length === 0 && warnings.length === 0, missing: missing, warnings: warnings };
  }

  function buildNotice(i) {
    var L = [];
    L.push('取 引 条 件 通 知 書（フリーランス・事業者間取引適正化等法 第3条）');
    L.push('');
    L.push('発注事業者: ' + (i.clientName || '【未記入】'));
    L.push('受注者（フリーランス）: ' + (i.freelancerName || '【未記入】'));
    L.push('業務委託をした日: ' + (i.orderDate || '【未記入】'));
    L.push('業務の内容: ' + (i.content || '【未記入】'));
    L.push('納品（受領／提供）期日: ' + (i.deliveryDate || '【未記入】'));
    L.push('納品（受領／提供）場所: ' + (i.place || '【未記入】'));
    if (i.inspection) L.push('検査完了日: ' + (i.inspectionDate || '【未記入】'));
    L.push('報酬額: ' + (i.reward || '【未記入】') + (i.rewardUndetermined ? '（算定方法: ' + (i.rewardMethod || '【未記入】') + '）' : ''));
    L.push('報酬支払期日: ' + (i.payDate || '【未記入】'));
    if (i.nonCash) L.push('支払方法（現金以外）: ' + (i.nonCashMethod || '【未記入】'));
    L.push('');
    L.push('※本書面は一般的な書式例です。法的助言ではありません。公開・利用前に専門家または公的窓口で確認してください。');
    return L.join('\n');
  }

  // 第5条 禁止行為（1か月以上の業務委託）セルフチェック
  var PROHIBITED = [
    '成果物の受領を、フリーランスに責任がないのに拒否する',
    '発注時に定めた報酬を、フリーランスに責任がないのに減額する',
    '成果物を受領後、フリーランスに責任がないのに返品する',
    '通常支払われる対価に比べ著しく低い報酬を不当に定める（買いたたき）',
    '正当な理由なく、指定する物の購入・役務の利用を強制する',
    '自己のために金銭・役務その他の経済上の利益を提供させる',
    'フリーランスに責任がないのに、給付内容を変更させる／やり直しをさせる（費用負担なしに）',
  ];

  return {
    REQUIRED_ITEMS: REQUIRED_ITEMS, PROHIBITED: PROHIBITED,
    parse: parse, fmt: fmt, deadline60: deadline60, deadlineTwoMonths: deadlineTwoMonths,
    paymentDateFor: paymentDateFor, verifyPaymentRule: verifyPaymentRule,
    verifyPaymentRuleYear: verifyPaymentRuleYear, checkTerms: checkTerms, buildNotice: buildNotice,
    diffDaysInclusive: diffDaysInclusive,
  };
});
