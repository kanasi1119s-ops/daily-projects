// 取引条件明示ジェネレーター: ロジック(DOM非依存)
// 参照: 特定受託事業者に係る取引の適正化等に関する法律 第3条 / 第4条
export const MS_DAY = 86400000;

export const FIELDS = [
  { key: 'clientName', label: '発注事業者の名称', required: true },
  { key: 'freelancerName', label: '特定受託事業者(フリーランス)の名称', required: true },
  { key: 'orderDate', label: '業務委託をした日', required: true, type: 'date' },
  { key: 'workContent', label: '給付の内容(業務内容)', required: true },
  { key: 'deliveryDate', label: '給付を受領/役務の提供を受ける期日', required: true, type: 'date' },
  { key: 'deliveryPlace', label: '給付を受領/役務の提供を受ける場所', required: true },
  { key: 'inspection', label: '検査をするか', required: true, type: 'bool' },
  { key: 'inspectionDate', label: '検査完了日', requiredIf: (d) => d.inspection === 'yes', type: 'date' },
  { key: 'amount', label: '報酬の額(円)', required: true, type: 'number' },
  { key: 'paymentDate', label: '報酬の支払期日', required: true, type: 'date' },
  { key: 'paymentMethod', label: '報酬の支払方法', required: true },
];

export function parseDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

export function formatDate(t) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export function toISO(t) {
  return new Date(t).toISOString().slice(0, 10);
}

// 第4条: 受領日(役務提供を受けた日)から起算して60日以内。受領日を1日目とする運用基準に従い、受領日+59日が最終日。
export function paymentDeadline(receiptISO) {
  const t = parseDate(receiptISO);
  if (t === null) return null;
  return toISO(t + 59 * MS_DAY);
}

// 戻り値: { errors: [{key,message}], warnings: [string] }
// 全角数字・カンマ・円記号を許容して正規化
export function normalizeAmount(v) {
  return String(v ?? '').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，円¥\s]/g, '');
}

export function validate(d) {
  d = { ...d, amount: normalizeAmount(d.amount) };
  const errors = [];
  const warnings = [];
  for (const f of FIELDS) {
    const need = f.required || (f.requiredIf && f.requiredIf(d));
    const v = (d[f.key] ?? '').toString().trim();
    if (need && !v) errors.push({ key: f.key, message: `「${f.label}」は必須です` });
  }
  const dateKeys = FIELDS.filter((f) => f.type === 'date').map((f) => f.key);
  for (const k of dateKeys) {
    if (d[k] && parseDate(d[k]) === null) errors.push({ key: k, message: `「${FIELDS.find((f) => f.key === k).label}」の日付が正しくありません` });
  }
  if (d.amount !== undefined && d.amount !== '') {
    const n = Number(d.amount);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) errors.push({ key: 'amount', message: '報酬の額は0以上の整数で入力してください' });
  }
  const od = parseDate(d.orderDate), dd = parseDate(d.deliveryDate), pd = parseDate(d.paymentDate);
  if (od !== null && dd !== null && dd < od) errors.push({ key: 'deliveryDate', message: '受領期日が業務委託日より前になっています' });
  if (dd !== null && pd !== null) {
    if (pd < dd) errors.push({ key: 'paymentDate', message: '支払期日が受領期日より前になっています' });
    const limit = parseDate(paymentDeadline(d.deliveryDate));
    if (pd > limit) errors.push({ key: 'paymentDate', message: `支払期日が受領日から60日の上限(${formatDate(limit)})を超えています(第4条)` });
  }
  if (d.inspection === 'yes') {
    const ins = parseDate(d.inspectionDate);
    if (ins !== null && dd !== null && ins < dd) errors.push({ key: 'inspectionDate', message: '検査完了日が受領期日より前になっています' });
  }
  if (d.clientName && d.freelancerName && d.clientName.trim() === d.freelancerName.trim()) warnings.push('発注事業者とフリーランスの名称が同じです');
  if (d.paymentMethod && !/現金|振込|銀行/.test(d.paymentMethod)) warnings.push('現金以外の支払方法の場合は、その方法に関する事項(手数料の負担等)の明示が必要になる場合があります。');
  return { errors, warnings };
}

export function yen(n) {
  return Number(n).toLocaleString('ja-JP') + '円';
}

export function generateDocument(d) {
  d = { ...d, amount: normalizeAmount(d.amount) };
  const lines = [
    '取 引 条 件 明 示 書',
    '(特定受託事業者に係る取引の適正化等に関する法律 第3条に基づく明示)',
    '',
    `宛先: ${d.freelancerName.trim()} 殿`,
    `発注者: ${d.clientName.trim()}`,
    '',
    `1. 業務委託をした日: ${formatDate(parseDate(d.orderDate))}`,
    `2. 給付の内容: ${d.workContent.trim()}`,
    `3. 給付を受領する(役務の提供を受ける)期日: ${formatDate(parseDate(d.deliveryDate))}`,
    `4. 給付を受領する(役務の提供を受ける)場所: ${d.deliveryPlace.trim()}`,
    d.inspection === 'yes'
      ? `5. 検査: あり(検査完了日: ${formatDate(parseDate(d.inspectionDate))})`
      : '5. 検査: なし',
    `6. 報酬の額: ${yen(d.amount)}${d.taxNote?.trim() ? `(消費税の取扱い: ${d.taxNote.trim()})` : ''}`,
    `7. 報酬の支払期日: ${formatDate(parseDate(d.paymentDate))}`,
    `8. 報酬の支払方法: ${d.paymentMethod.trim()}`,
  ];
  if (d.notes?.trim()) lines.push('', `特記事項: ${d.notes.trim()}`);
  lines.push('', '※本書は入力内容を整形したものであり、法的助言ではありません。内容の最終確認は発注者の責任で行ってください。');
  return lines.join('\n');
}
