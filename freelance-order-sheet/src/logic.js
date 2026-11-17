// 取引条件明示書(フリーランス新法 第3条関連)の検証・文書生成ロジック。純粋関数のみ。
// 注意: 法的助言ではない。項目は公正取引委員会規則等の一次情報で必ず確認すること。

export const MS_PER_DAY = 86400000;

export function parseDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

export function daysBetween(fromStr, toStr) {
  const a = parseDate(fromStr);
  const b = parseDate(toStr);
  if (a === null || b === null) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

export function formatDateJa(s) {
  const t = parseDate(s);
  if (t === null) return '';
  const d = new Date(t);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export function formatYen(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return `${Math.round(v).toLocaleString('ja-JP')}円`;
}

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * @returns {{level:'error'|'warn', field:string, message:string}[]}
 */
export function validate(f) {
  const issues = [];
  const err = (field, message) => issues.push({ level: 'error', field, message });
  const warn = (field, message) => issues.push({ level: 'warn', field, message });

  if (blank(f.clientName)) err('clientName', '発注事業者の名称(氏名)が未入力です。');
  if (blank(f.freelancerName)) err('freelancerName', 'フリーランス(受託者)の名称(氏名)が未入力です。');

  if (blank(f.orderDate)) err('orderDate', '業務委託をした日が未入力です。');
  else if (parseDate(f.orderDate) === null) err('orderDate', '業務委託をした日の日付形式が不正です。');

  if (blank(f.workContent)) err('workContent', '業務(給付)の内容が未入力です。');
  else if (f.workContent.trim().length < 10) warn('workContent', '業務内容が短すぎます。仕様・数量・品質など、後で認識違いが起きない程度に具体化してください。');

  const hasDelivery = !blank(f.deliveryDate);
  if (!hasDelivery) err('deliveryDate', '納期(給付を受領する日/役務の提供を受ける日)が未入力です。');
  else if (parseDate(f.deliveryDate) === null) err('deliveryDate', '納期の日付形式が不正です。');

  if (blank(f.deliveryPlace)) err('deliveryPlace', '納品場所(または役務提供場所・オンライン納品の方法)が未入力です。');

  if (f.inspection === 'yes') {
    if (blank(f.inspectionDate)) err('inspectionDate', '検査をする場合は検査完了日の明示が必要です。');
    else if (parseDate(f.inspectionDate) === null) err('inspectionDate', '検査完了日の日付形式が不正です。');
    else if (hasDelivery && daysBetween(f.deliveryDate, f.inspectionDate) < 0)
      warn('inspectionDate', '検査完了日が納期より前になっています。');
  }

  const hasAmount = !blank(f.feeAmount) && Number.isFinite(Number(f.feeAmount)) && Number(f.feeAmount) >= 0;
  if (!blank(f.feeAmount) && !hasAmount) err('feeAmount', '報酬額は0以上の数値で入力してください。');
  if (!hasAmount && blank(f.feeMethod)) err('feeAmount', '報酬の額(または算定方法)が未入力です。');
  if (hasAmount && Number(f.feeAmount) === 0) warn('feeAmount', '報酬が0円になっています。意図したものか確認してください。');
  if (hasAmount && f.taxMode === undefined) warn('taxMode', '消費税の扱い(税込/税別)を選択してください。');

  if (blank(f.paymentDue)) err('paymentDue', '支払期日が未入力です。');
  else if (parseDate(f.paymentDue) === null) err('paymentDue', '支払期日の日付形式が不正です。');
  else if (hasDelivery && parseDate(f.deliveryDate) !== null) {
    const diff = daysBetween(f.deliveryDate, f.paymentDue);
    if (diff > 60)
      err('paymentDue', `支払期日が納期(受領日)から${diff}日後です。原則、受領日から60日以内で、できる限り短い期間内に設定する必要があります。`);
    else if (diff === 60)
      warn('paymentDue', '支払期日がちょうど60日後です。初日算入の解釈で超過する可能性があるため、59日以内を推奨します。');
    else if (diff < 0) warn('paymentDue', '支払期日が納期より前になっています。');
  }

  if (f.paymentMethod === 'other' && blank(f.paymentMethodDetail))
    err('paymentMethodDetail', '現金以外で支払う場合は、支払方法に関する必要事項(方法・条件)の明示が必要です。');

  if (f.resubcontract === 'yes') {
    if (blank(f.originalPaymentDue))
      err('originalPaymentDue', '再委託の場合は、元委託の支払期日を明示してください(再委託時の特例の対象か要確認)。');
  }

  if (!blank(f.orderDate) && hasDelivery && daysBetween(f.orderDate, f.deliveryDate) < 0)
    warn('orderDate', '業務委託をした日が納期より後になっています。');

  return issues;
}

export function hasErrors(issues) {
  return issues.some((i) => i.level === 'error');
}

export function buildDocument(f) {
  const L = [];
  const v = (s) => (blank(s) ? '（未記入）' : String(s).trim());
  L.push('取引条件明示書');
  L.push('（特定受託事業者に係る取引の適正化等に関する法律に基づく明示事項）');
  L.push('');
  L.push(`発注事業者: ${v(f.clientName)}`);
  L.push(`フリーランス(受託者): ${v(f.freelancerName)}`);
  L.push(`業務委託をした日: ${formatDateJa(f.orderDate) || '（未記入）'}`);
  L.push('');
  L.push('1. 業務(給付)の内容');
  L.push(v(f.workContent));
  if (!blank(f.ipNote)) L.push(`※知的財産権の取扱い: ${f.ipNote.trim()}`);
  L.push('');
  L.push(`2. 納期（給付を受領する日/役務の提供を受ける日）: ${formatDateJa(f.deliveryDate) || '（未記入）'}`);
  L.push(`3. 納品場所・提供場所: ${v(f.deliveryPlace)}`);
  if (f.inspection === 'yes') L.push(`4. 検査完了日: ${formatDateJa(f.inspectionDate) || '（未記入）'}`);
  else L.push('4. 検査: なし（受領をもって完了）');
  const hasAmount = !blank(f.feeAmount) && Number.isFinite(Number(f.feeAmount));
  const tax = f.taxMode === 'incl' ? '（税込）' : f.taxMode === 'excl' ? '（税別）' : '';
  const feeParts = [];
  if (hasAmount) feeParts.push(formatYen(f.feeAmount) + tax);
  if (!blank(f.feeMethod)) feeParts.push('算定方法: ' + f.feeMethod.trim());
  L.push(`5. 報酬の額: ${feeParts.length ? feeParts.join(' / ') : '（未記入）'}`);
  L.push(`6. 支払期日: ${formatDateJa(f.paymentDue) || '（未記入）'}`);
  if (f.paymentMethod === 'other') L.push(`7. 支払方法（現金以外）: ${v(f.paymentMethodDetail)}`);
  else L.push('7. 支払方法: 金融機関への振込（現金）');
  if (f.resubcontract === 'yes') L.push(`8. 再委託: 本件は再委託に当たります。元委託の支払期日: ${formatDateJa(f.originalPaymentDue) || '（未記入）'}`);
  L.push('');
  L.push('本書面は取引条件の明示を目的とする書式です。法的助言ではなく、個別の契約内容は当事者・専門家が確認してください。');
  return L.join('\n');
}

export function summarize(issues) {
  const e = issues.filter((i) => i.level === 'error').length;
  const w = issues.length - e;
  return { errors: e, warns: w };
}
