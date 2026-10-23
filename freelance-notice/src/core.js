// 取引条件明示書ジェネレーター: 純粋関数(ブラウザ/Node両対応)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NoticeCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const REQUIRED = [
    ['clientName', '発注事業者の名称'],
    ['freelancerName', 'フリーランスの名称'],
    ['orderDate', '業務委託をした日'],
    ['description', '業務(給付)の内容'],
    ['deliveryDate', '給付の受領/役務提供の期日'],
    ['deliveryPlace', '受領/提供の場所'],
    ['fee', '報酬の額'],
    ['paymentDue', '報酬の支払期日'],
  ];

  function parseDate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  const DATE_LABELS = { orderDate: '業務委託をした日', deliveryDate: '受領/提供の期日', paymentDue: '支払期日', inspectionDate: '検査完了日' };

  // 全角数字・カンマ・円記号を除去して半角整数文字列へ
  function normalizeFee(s) {
    return String(s ?? '')
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[,，円¥\s]/g, '');
  }

  function formatYen(n) {
    return '¥' + Number(n).toLocaleString('ja-JP');
  }

  // 検証: errors(必須不足・不正値) と warnings(60日ルール等)を返す
  function validate(f) {
    const errors = [];
    const warnings = [];
    const v = f || {};
    for (const [k, label] of REQUIRED) {
      if (k === 'fee' && v.feeUndetermined === 'yes') continue;
      if (v[k] === undefined || v[k] === null || String(v[k]).trim() === '') errors.push(`${label}が未入力です`);
    }
    const feeStr = normalizeFee(v.fee);
    const fee = Number(feeStr);
    if (v.feeUndetermined !== 'yes' && feeStr !== '' && (!Number.isFinite(fee) || fee < 0 || !Number.isInteger(fee))) {
      errors.push('報酬の額は0以上の整数(円)で入力してください');
    }
    for (const k of ['orderDate', 'deliveryDate', 'paymentDue', 'inspectionDate']) {
      if (v[k] && !parseDate(v[k])) errors.push(`${DATE_LABELS[k]}の日付形式が不正です`);
    }
    const od = parseDate(v.orderDate), dd = parseDate(v.deliveryDate), pd = parseDate(v.paymentDue);
    if (od && dd && dd < od) errors.push('受領/提供の期日が委託日より前になっています');
    if (dd && pd) {
      if (pd < dd) warnings.push('支払期日が受領日より前です。内容を再確認してください');
      const gap = daysBetween(dd, pd);
      if (gap > 60) {
        warnings.push(`支払期日が受領日から${gap}日後です。フリーランス新法は受領日から起算して60日以内のできる限り短い期間内の支払を求めています`);
      }
    }
    if (v.inspection === 'yes' && !v.inspectionDate) warnings.push('検査を行う場合は検査完了日の記載が必要です');
    if (feeStr !== '' && fee === 0) warnings.push('報酬が0円です。意図したものか確認してください');
    if (v.feeUndetermined === 'yes' && !String(v.feeCalc || '').trim()) {
      errors.push('報酬額が未定の場合は算定方法を入力してください');
    }
    return { errors, warnings, ok: errors.length === 0 };
  }

  // 明示書テキストを生成
  function buildNotice(f) {
    const L = [];
    L.push('取引条件明示書(特定受託事業者に係る取引の適正化等に関する法律 第3条に基づく明示)');
    L.push('');
    L.push(`発注事業者: ${f.clientName}`);
    L.push(`フリーランス(受注者): ${f.freelancerName}`);
    L.push(`業務委託をした日: ${f.orderDate}`);
    L.push('');
    L.push(`1. 業務(給付)の内容: ${f.description}`);
    L.push(`2. 受領/役務提供の期日: ${f.deliveryDate}`);
    L.push(`3. 受領/役務提供の場所: ${f.deliveryPlace}`);
    if (f.inspection === 'yes') L.push(`4. 検査完了日: ${f.inspectionDate || '(未記入)'}`);
    else L.push('4. 検査: なし');
    if (f.feeUndetermined === 'yes') {
      L.push(`5. 報酬の額: 未定(算定方法: ${f.feeCalc})`);
    } else {
      L.push(`5. 報酬の額: ${formatYen(normalizeFee(f.fee))}${f.taxNote ? `(${f.taxNote})` : ''}`);
    }
    L.push(`6. 報酬の支払期日: ${f.paymentDue}`);
    L.push(`7. 支払方法: ${f.paymentMethod || '銀行振込'}`);
    if (f.notes && String(f.notes).trim()) L.push(`8. 備考: ${f.notes}`);
    L.push('');
    L.push('※本書は入力内容を書式に整えたものであり、法的助言ではありません。');
    return L.join('\n');
  }

  return { normalizeFee, REQUIRED, parseDate, daysBetween, formatYen, validate, buildNotice };
});
