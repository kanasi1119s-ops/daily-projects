// フリーランス・事業者間取引適正化等法(以下「法」)第3条・第4条に基づく入力チェック。
// 法的助言ではなく、記載漏れ・期日超過の気づきを得るための簡易チェックである。

const MS_PER_DAY = 86400000;

export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

export function daysBetween(from, to) {
  const a = parseDate(from);
  const b = parseDate(to);
  if (a === null || b === null) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

// 全角数字・カンマ・「円」を許容して整数文字列に正規化する(不正なら元の文字列を返す)。
export function normalizeFee(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').replace(/[,\s]/g, '').replace(/円$/, '');
}

const isBlank = (v) => typeof v !== 'string' || v.trim() === '';

const REQUIRED_TEXT = [
  ['clientName', '発注事業者の名称'],
  ['freelancerName', 'フリーランス(受注者)の名称'],
  ['workContent', '給付の内容(業務内容)'],
  ['place', '給付を受領する場所/役務の提供を受ける場所'],
];

const REQUIRED_DATE = [
  ['orderDate', '業務委託をした日'],
  ['deliveryDate', '給付を受領する日/役務の提供を受ける日'],
  ['payDue', '報酬の支払期日'],
];

/**
 * @returns {{errors: string[], warnings: string[], infos: string[], payDays: number|null}}
 */
export function validate(d) {
  const errors = [];
  const warnings = [];
  const infos = [];
  const data = d || {};

  for (const [key, label] of REQUIRED_TEXT) {
    if (isBlank(data[key])) errors.push(`${label}が未入力です(法第3条)。`);
  }

  for (const [key, label] of REQUIRED_DATE) {
    if (isBlank(data[key])) errors.push(`${label}が未入力です(法第3条)。`);
    else if (parseDate(data[key]) === null) errors.push(`${label}が正しい日付ではありません。`);
  }

  const hasFee = !isBlank(data.fee);
  const hasMethod = !isBlank(data.feeMethod);
  if (hasFee) {
    const fee = normalizeFee(data.fee);
    if (!/^\d+$/.test(fee) || Number(fee) <= 0) {
      errors.push('報酬の額は1円以上の整数で入力してください。');
    }
  } else if (!hasMethod) {
    errors.push('報酬の額、または額を定められない場合の算定方法のいずれかが必要です(法第3条)。');
  } else {
    infos.push('報酬の額が未定のため、算定方法のみ記載します。算定方法は具体的な単価・数量などで確定できる内容にしてください。');
  }

  if (data.inspection) {
    if (isBlank(data.inspectionDate)) errors.push('検査(検収)を行う場合は、検査を完了する日が必要です(法第3条)。');
    else if (parseDate(data.inspectionDate) === null) errors.push('検査完了日が正しい日付ではありません。');
  }

  if (data.cashless && isBlank(data.cashlessDetail)) {
    errors.push('現金以外の方法で支払う場合は、その方法に関する事項の記載が必要です(法第3条)。');
  }

  let payDays = null;
  const delivery = parseDate(data.deliveryDate);
  if (delivery !== null && parseDate(data.payDue) !== null) {
    payDays = daysBetween(data.deliveryDate, data.payDue);
    if (payDays < 0) {
      errors.push('支払期日が給付を受領する日より前になっています。');
    } else if (payDays > 60) {
      errors.push(`支払期日が受領日から${payDays}日後です。法第4条により、受領日から起算して60日以内でできるだけ短い期間内に定める必要があります。`);
    } else if (payDays >= 55) {
      warnings.push(`支払期日が受領日から${payDays}日後で、60日の上限に近い設定です。「できるだけ短い期間内」で設定されているか確認してください。`);
    }
    if (data.inspection) {
      infos.push('支払期日は検査完了日ではなく、給付を受領した日から数えて60日以内が基準です。');
    }
  }

  const order = parseDate(data.orderDate);
  if (order !== null && delivery !== null && order > delivery) {
    warnings.push('業務委託をした日が受領日より後になっています。日付を確認してください。');
  }
  const insp = parseDate(data.inspectionDate);
  if (data.inspection && insp !== null && delivery !== null && insp < delivery) {
    warnings.push('検査完了日が受領日より前になっています。日付を確認してください。');
  }

  return { errors, warnings, infos, payDays };
}
