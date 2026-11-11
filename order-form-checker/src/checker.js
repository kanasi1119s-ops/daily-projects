// 取引条件明示チェッカー: コアロジック（DOM非依存・Nodeでテスト可能）
// 注意: 法的助言ではない。項目は公開情報に基づく一般的な整理であり、公式資料での確認が必要。

export const FIELDS = [
  { key: 'clientName', label: '発注者の名称', required: true },
  { key: 'contractorName', label: '受注者（フリーランス）の名称', required: true },
  { key: 'orderDate', label: '業務委託をした日', required: true, type: 'date' },
  { key: 'description', label: '給付（業務）の内容', required: true },
  { key: 'deliveryDate', label: '給付を受領／役務提供を受ける期日', required: true, type: 'date' },
  { key: 'deliveryPlace', label: '給付を受領／役務提供を受ける場所', required: true },
  { key: 'inspectionDate', label: '検査を行う場合の完了日', required: false, type: 'date' },
  { key: 'amount', label: '報酬の額（税抜／税込の別を含む）', required: true, type: 'amount' },
  { key: 'paymentDate', label: '報酬の支払期日', required: true, type: 'date' },
  { key: 'paymentMethod', label: '現金以外の方法で支払う場合の方法', required: false },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function parseAmount(s) {
  if (s === undefined || s === null) return null;
  const t = String(s).replace(/[,，円¥\s]/g, '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

const blank = v => v === undefined || v === null || String(v).trim() === '';

/** @returns {{items: Array, errors: number, warnings: number}} */
export function check(form) {
  const items = [];
  for (const f of FIELDS) {
    const v = form[f.key];
    if (blank(v)) {
      items.push({ key: f.key, label: f.label, status: f.required ? 'missing' : 'optional', message: f.required ? '未記入です' : '該当する場合のみ記入' });
      continue;
    }
    if (f.type === 'date' && !parseDate(v)) {
      items.push({ key: f.key, label: f.label, status: 'invalid', message: '日付が不正です（YYYY-MM-DD）' });
    } else if (f.type === 'amount') {
      const n = parseAmount(v);
      if (n === null || n <= 0) items.push({ key: f.key, label: f.label, status: 'invalid', message: '報酬額は1以上の数値で入力してください' });
      else if (!form.taxIncluded) items.push({ key: f.key, label: f.label, status: 'warn', message: '税込／税抜の区別を選択してください' });
      else items.push({ key: f.key, label: f.label, status: 'ok', message: '' });
    } else {
      items.push({ key: f.key, label: f.label, status: 'ok', message: '' });
    }
  }
  const byKey = Object.fromEntries(items.map(i => [i.key, i]));
  const od = parseDate(form.orderDate), dd = parseDate(form.deliveryDate), pd = parseDate(form.paymentDate), id = parseDate(form.inspectionDate);
  const warn = (key, message) => { const it = byKey[key]; if (it && it.status === 'ok') { it.status = 'warn'; it.message = message; } };
  if (od && dd && dd < od) warn('deliveryDate', '納期が委託日より前です');
  if (dd && id && id < dd) warn('inspectionDate', '検査完了日が納期より前です');
  if (dd && pd) {
    const gap = daysBetween(dd, pd);
    if (gap < 0) warn('paymentDate', '支払期日が納期より前です');
    else if (gap > 60) warn('paymentDate', `納期から${gap}日後です。受領日から60日以内の支払期日設定が求められるため要確認`);
  }
  const errors = items.filter(i => i.status === 'missing' || i.status === 'invalid').length;
  const warnings = items.filter(i => i.status === 'warn').length;
  return { items, errors, warnings };
}

export function generateText(form) {
  const L = [];
  const row = (label, v) => L.push(`${label}：${blank(v) ? '【未記入】' : String(v).trim()}`);
  L.push('発 注 書（取引条件明示）', '');
  row('発注者', form.clientName);
  row('受注者', form.contractorName);
  row('委託日', form.orderDate);
  row('業務内容', form.description);
  row('納期', form.deliveryDate);
  row('納品場所／方法', form.deliveryPlace);
  if (!blank(form.inspectionDate)) row('検査完了日', form.inspectionDate);
  const n = parseAmount(form.amount);
  row('報酬額', n === null ? form.amount : `${n.toLocaleString('ja-JP')}円（${form.taxIncluded === 'incl' ? '税込' : form.taxIncluded === 'excl' ? '税抜' : '税込／税抜 未選択'}）`);
  row('支払期日', form.paymentDate);
  if (!blank(form.paymentMethod)) row('支払方法（現金以外）', form.paymentMethod);
  L.push('', '※本書面は雛形です。内容は当事者の責任で確認してください。');
  return L.join('\n');
}
