// 取引条件明示ツールの純粋ロジック(DOM非依存・テスト対象)

export const REQUIRED_FIELDS = [
  { key: 'clientName', label: '発注事業者の名称' },
  { key: 'freelancerName', label: 'フリーランスの名称' },
  { key: 'orderDate', label: '業務委託をした日' },
  { key: 'workDescription', label: '給付(業務)の内容' },
  { key: 'deliveryDate', label: '給付を受領する日/役務の提供を受ける日' },
  { key: 'deliveryPlace', label: '給付を受領する場所/役務の提供を受ける場所' },
  { key: 'amount', label: '報酬の額' },
  { key: 'paymentDate', label: '報酬の支払期日' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function formatDate(dt) {
  return dt.toISOString().slice(0, 10);
}

export function formatJa(s) {
  const dt = parseDate(s);
  if (!dt) return '';
  return `${dt.getUTCFullYear()}年${dt.getUTCMonth() + 1}月${dt.getUTCDate()}日`;
}

export function addDays(s, n) {
  const dt = parseDate(s);
  if (!dt) return null;
  dt.setUTCDate(dt.getUTCDate() + n);
  return formatDate(dt);
}

/**
 * 支払期日の上限(目安)。受領日(役務提供日)を1日目として60日目。
 * 起算日を算入する安全側の数え方を採用(法定の上限を超えないよう1日手前に倒す)。
 */
export function latestPaymentDate(receiptDate) {
  return addDays(receiptDate, 59);
}

export function parseAmount(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).normalize('NFKC').replace(/[,\s円¥]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export function formatYen(n) {
  return `${n.toLocaleString('ja-JP')}円`;
}

/** @returns {{errors: string[], warnings: string[]}} errors=必須明示事項の不備, warnings=注意喚起 */
export function validate(form) {
  const errors = [];
  const warnings = [];
  const f = form || {};

  for (const { key, label } of REQUIRED_FIELDS) {
    if (key === 'amount' && f.amountUndecided === true) continue;
    const v = f[key];
    if (v === undefined || v === null || String(v).trim() === '') errors.push(`「${label}」が未入力です`);
  }

  const dateLabels = { ...Object.fromEntries(REQUIRED_FIELDS.map((r) => [r.key, r.label])), inspectionDate: '検査を完了する日' };
  for (const key of ['orderDate', 'deliveryDate', 'paymentDate', 'inspectionDate']) {
    if (f[key] && !parseDate(f[key])) errors.push(`「${dateLabels[key]}」の日付の形式が正しくありません`);
  }

  if (f.amountUndecided === true) {
    if (!String(f.amountMethod || '').trim()) errors.push('報酬額が未定の場合は、算定方法を入力してください');
  } else if (f.amount !== undefined && f.amount !== '' && parseAmount(f.amount) === null) {
    errors.push('報酬の額は0以上の整数(円)で入力してください');
  } else if (parseAmount(f.amount) === 0) {
    warnings.push('報酬の額が0円になっています。意図した金額か確認してください');
  }

  if (f.inspect === true && !f.inspectionDate) {
    errors.push('検査をする場合は「検査を完了する日」を入力してください');
  }

  if (f.nonCash === true && !String(f.nonCashMethod || '').trim()) {
    errors.push('現金以外で支払う場合は、その支払方法を入力してください');
  }

  const order = parseDate(f.orderDate);
  const delivery = parseDate(f.deliveryDate);
  const pay = parseDate(f.paymentDate);
  if (order && delivery && delivery < order) warnings.push('受領日(提供日)が業務委託日より前になっています');

  if (delivery && pay) {
    const limit = latestPaymentDate(f.deliveryDate);
    if (pay < delivery) {
      warnings.push('支払期日が受領日より前になっています(前払い等の場合は問題ありません)');
    } else if (pay > parseDate(limit)) {
      warnings.push(
        `支払期日が受領日から60日を超えている可能性があります(目安の上限: ${formatJa(limit)})。` +
          'フリーランス新法では受領日から60日以内のできる限り短い期間内に支払期日を定める必要があります'
      );
    }
  }

  if (f.amountUndecided === true) {
    warnings.push('報酬額が未定の場合は、算定方法を明示し、額が確定後すみやかに書面等で通知する必要があります');
  }

  return { errors, warnings };
}

/** 明示用の書面テキストを生成する */
export function generateDocument(form) {
  const f = form || {};
  const amt = parseAmount(f.amount);
  const lines = [];
  lines.push('取引条件明示書');
  lines.push('(特定受託事業者に係る取引の適正化等に関する法律 第3条に基づく明示事項)');
  lines.push('');
  lines.push(`発注事業者: ${f.clientName || '(未入力)'}`);
  lines.push(`フリーランス(受託者): ${f.freelancerName || '(未入力)'}`);
  lines.push(`業務委託をした日: ${formatJa(f.orderDate) || '(未入力)'}`);
  lines.push('');
  lines.push('1. 給付(業務)の内容');
  lines.push(f.workDescription ? String(f.workDescription).trim() : '(未入力)');
  lines.push('');
  lines.push('2. 給付を受領する日(役務の提供を受ける日)');
  lines.push(formatJa(f.deliveryDate) || '(未入力)');
  lines.push('');
  lines.push('3. 給付を受領する場所(役務の提供を受ける場所)');
  lines.push(f.deliveryPlace ? String(f.deliveryPlace).trim() : '(未入力)');
  lines.push('');
  lines.push('4. 検査');
  lines.push(f.inspect === true ? `検査あり。検査完了日: ${formatJa(f.inspectionDate) || '(未入力)'}` : '検査なし');
  lines.push('');
  lines.push('5. 報酬の額');
  if (f.amountUndecided === true) {
    lines.push(`未定(算定方法: ${String(f.amountMethod || '').trim() || '(未入力)'})`);
  } else {
    const tax = f.taxIncluded === false ? '(税抜)' : '(税込)';
    lines.push(amt === null ? '(未入力)' : `${formatYen(amt)} ${tax}`);
  }
  lines.push('');
  lines.push('6. 報酬の支払期日');
  lines.push(formatJa(f.paymentDate) || '(未入力)');
  lines.push('');
  lines.push('7. 支払方法');
  if (f.nonCash === true) {
    lines.push(`現金以外の方法: ${String(f.nonCashMethod || '').trim() || '(未入力)'}`);
  } else {
    lines.push('現金(銀行振込等)');
  }
  lines.push('');
  lines.push('※ 本書面は入力内容から機械的に生成した雛形です。法的助言ではありません。');
  return lines.join('\n');
}
