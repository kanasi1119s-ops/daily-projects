export type Severity = 'error' | 'warn';

export interface NoticeInput {
  clientName: string;
  clientContact: string;
  freelancerName: string;
  orderDate: string; // YYYY-MM-DD 業務委託をした日
  description: string; // 給付の内容
  deliveryDate: string; // 給付を受領する日 / 役務提供を受ける日
  deliveryPlace: string;
  hasInspection: boolean;
  inspectionDate: string; // 検査完了日
  feeType: 'fixed' | 'formula';
  feeAmount: string; // 数値文字列（税抜/税込は feeTax）
  feeFormula: string; // 算定方法
  feeTax: 'excl' | 'incl';
  paymentDate: string; // 支払期日
  paymentMethod: 'bank' | 'other';
  paymentMethodNote: string;
  isSubcontract: boolean; // 再委託か
  monthlyClosing: boolean; // 月単位の締切制度
}

export interface Issue {
  severity: Severity;
  field: string;
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function formatDate(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toJa(s: string): string {
  const dt = parseDate(s);
  if (!dt) return '';
  return `${dt.getUTCFullYear()}年${dt.getUTCMonth() + 1}月${dt.getUTCDate()}日`;
}

export function addDays(dt: Date, days: number): Date {
  return new Date(dt.getTime() + days * 86400000);
}

export function endOfMonth(dt: Date): Date {
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0));
}

/** 支払期日の上限（法定の目安）。再委託は30日、通常は60日。 */
export function paymentLimitDays(isSubcontract: boolean): number {
  return isSubcontract ? 30 : 60;
}

/**
 * 支払期日の上限日を計算する。
 * 起算日は検査の有無に関わらず「給付を受領した日（役務提供を受けた日）」。
 * 月単位の締切制度の場合は、受領日の属する月の末日を起算日とみなす（要確認の簡易扱い）。
 */
export function calcPaymentLimit(
  deliveryDate: string,
  isSubcontract: boolean,
  monthlyClosing: boolean,
): string | null {
  const dt = parseDate(deliveryDate);
  if (!dt) return null;
  const base = monthlyClosing ? endOfMonth(dt) : dt;
  return formatDate(addDays(base, paymentLimitDays(isSubcontract)));
}

export function parseAmount(s: string): number | null {
  const t = s.normalize('NFKC').replace(/[,，\s円¥￥]/g, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export function validate(i: NoticeInput): Issue[] {
  const out: Issue[] = [];
  const req = (field: string, v: string, label: string) => {
    if (!v.trim()) out.push({ severity: 'error', field, message: `${label}が未入力です（明示必須事項）` });
  };
  req('clientName', i.clientName, '発注者（委託事業者）の名称');
  req('freelancerName', i.freelancerName, 'フリーランス（受託者）の名称');
  req('description', i.description, '給付の内容（業務内容）');
  req('deliveryPlace', i.deliveryPlace, '受領・提供場所');

  const order = parseDate(i.orderDate);
  if (!i.orderDate) out.push({ severity: 'error', field: 'orderDate', message: '業務委託をした日が未入力です（明示必須事項）' });
  else if (!order) out.push({ severity: 'error', field: 'orderDate', message: '業務委託をした日の日付形式が不正です' });

  const delivery = parseDate(i.deliveryDate);
  if (!i.deliveryDate) out.push({ severity: 'error', field: 'deliveryDate', message: '給付を受領する日（役務提供を受ける日）が未入力です（明示必須事項）' });
  else if (!delivery) out.push({ severity: 'error', field: 'deliveryDate', message: '納期の日付形式が不正です' });
  else if (order && delivery < order) out.push({ severity: 'warn', field: 'deliveryDate', message: '納期が委託日より前になっています' });

  if (i.hasInspection) {
    const insp = parseDate(i.inspectionDate);
    if (!i.inspectionDate) out.push({ severity: 'error', field: 'inspectionDate', message: '検査をする場合は検査完了日の明示が必要です' });
    else if (!insp) out.push({ severity: 'error', field: 'inspectionDate', message: '検査完了日の日付形式が不正です' });
    else if (delivery && insp < delivery) out.push({ severity: 'warn', field: 'inspectionDate', message: '検査完了日が納期より前になっています' });
  }

  if (i.feeType === 'fixed') {
    const n = parseAmount(i.feeAmount);
    if (n === null || n <= 0) out.push({ severity: 'error', field: 'feeAmount', message: '報酬額は1円以上の整数で入力してください' });
  } else if (!i.feeFormula.trim()) {
    out.push({ severity: 'error', field: 'feeFormula', message: '報酬額が未定の場合は具体的な算定方法の明示が必要です' });
  }

  if (i.paymentMethod === 'other' && !i.paymentMethodNote.trim()) {
    out.push({ severity: 'error', field: 'paymentMethodNote', message: '金銭以外（現金払い・口座振込以外）で支払う場合は、その支払方法の明示が必要です' });
  }

  const pay = parseDate(i.paymentDate);
  if (!i.paymentDate) out.push({ severity: 'error', field: 'paymentDate', message: '支払期日が未入力です（明示必須事項。具体的な日付で定める必要があります）' });
  else if (!pay) out.push({ severity: 'error', field: 'paymentDate', message: '支払期日の日付形式が不正です' });
  else if (delivery) {
    const limit = calcPaymentLimit(i.deliveryDate, i.isSubcontract, i.monthlyClosing);
    const limitDt = limit ? parseDate(limit) : null;
    if (limitDt && pay > limitDt) {
      out.push({
        severity: 'error',
        field: 'paymentDate',
        message: `支払期日が上限（${toJa(limit!)}）を超えています。受領日から${paymentLimitDays(i.isSubcontract)}日以内で、できる限り短い期間内に設定してください`,
      });
    }
    if (pay < delivery) out.push({ severity: 'warn', field: 'paymentDate', message: '支払期日が納期より前になっています（前払いの場合を除き確認してください）' });
  }
  return out;
}

export function buildNoticeText(i: NoticeInput): string {
  const yen = (s: string) => {
    const n = parseAmount(s);
    return n === null ? '（未入力）' : `${n.toLocaleString('ja-JP')}円`;
  };
  const fee =
    i.feeType === 'fixed'
      ? `${yen(i.feeAmount)}（${i.feeTax === 'incl' ? '消費税込' : '消費税別'}）`
      : `算定方法: ${i.feeFormula || '（未入力）'}`;
  const method = i.paymentMethod === 'bank' ? '銀行口座への振込' : i.paymentMethodNote || '（未入力）';
  const lines = [
    '取引条件明示書',
    '',
    `明示日: ${toJa(i.orderDate) || '（未入力）'}`,
    `発注者（委託事業者）: ${i.clientName || '（未入力）'}${i.clientContact ? `（連絡先: ${i.clientContact}）` : ''}`,
    `受託者（フリーランス）: ${i.freelancerName || '（未入力）'}`,
    '',
    `1. 業務委託をした日: ${toJa(i.orderDate) || '（未入力）'}`,
    `2. 給付の内容: ${i.description || '（未入力）'}`,
    `3. 給付を受領する日／役務の提供を受ける日: ${toJa(i.deliveryDate) || '（未入力）'}`,
    `4. 受領・提供場所: ${i.deliveryPlace || '（未入力）'}`,
    `5. 検査: ${i.hasInspection ? `あり（検査完了日: ${toJa(i.inspectionDate) || '（未入力）'}）` : 'なし'}`,
    `6. 報酬の額: ${fee}`,
    `7. 支払期日: ${toJa(i.paymentDate) || '（未入力）'}`,
    `8. 支払方法: ${method}`,
    ...(i.isSubcontract ? ['9. 再委託: 本業務は元請からの再委託に該当します'] : []),
    '',
    '※ 本書は入力内容をもとに作成した雛形です。法的助言ではありません。',
  ];
  return lines.join('\n');
}

export const emptyInput = (): NoticeInput => ({
  clientName: '',
  clientContact: '',
  freelancerName: '',
  orderDate: '',
  description: '',
  deliveryDate: '',
  deliveryPlace: '',
  hasInspection: false,
  inspectionDate: '',
  feeType: 'fixed',
  feeAmount: '',
  feeFormula: '',
  feeTax: 'excl',
  paymentDate: '',
  paymentMethod: 'bank',
  paymentMethodNote: '',
  isSubcontract: false,
  monthlyClosing: false,
});
