// フリーランス新法（特定受託事業者に係る取引の適正化等に関する法律）第3条・第4条に基づく
// 取引条件明示の簡易チェック。一般的な情報提供であり法的助言ではありません。

export interface OrderForm {
  clientName: string;        // 発注事業者の名称
  freelancerName: string;    // フリーランスの名称
  orderDate: string;         // 業務委託をした日 (YYYY-MM-DD)
  content: string;           // 給付の内容
  deliveryDate: string;      // 給付を受領／役務提供を受ける期日
  deliveryPlace: string;     // 給付の受領場所（納品先・納品方法）
  inspection: 'yes' | 'no';  // 検査をするか
  inspectionDate: string;    // 検査完了日
  fee: string;               // 報酬の額（算定方法でも可）
  paymentDate: string;       // 支払期日 (YYYY-MM-DD)
  paymentMethod: string;     // 報酬の支払方法（現金以外の場合は必須）
  paymentIsCash: boolean;    // 現金（銀行振込含む）で支払うか
}

export const emptyForm: OrderForm = {
  clientName: '', freelancerName: '', orderDate: '', content: '', deliveryDate: '',
  deliveryPlace: '', inspection: 'no', inspectionDate: '', fee: '', paymentDate: '',
  paymentMethod: '', paymentIsCash: true,
};

export type Severity = 'error' | 'warn';
export interface Finding { field: keyof OrderForm | 'general'; severity: Severity; message: string; }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

// 金額欄に「円」「万円」や数字がまったく無い場合、または曖昧表現を含む場合の検出
const VAGUE_FEE = /(応相談|別途協議|未定|要相談|適宜|別途)/;
export function feeIsConcrete(fee: string): boolean {
  const t = fee.trim();
  if (!t) return false;
  if (VAGUE_FEE.test(t)) return false;
  return /[0-9０-９]|[一二三四五六七八九十百千万]/.test(t);
}

export function validate(f: OrderForm): Finding[] {
  const out: Finding[] = [];
  const req = (v: string, field: keyof OrderForm, label: string) => {
    if (!v.trim()) out.push({ field, severity: 'error', message: `「${label}」が未入力です（第3条の明示事項）。` });
  };
  req(f.clientName, 'clientName', '発注事業者の名称');
  req(f.freelancerName, 'freelancerName', 'フリーランスの名称');
  req(f.content, 'content', '給付（業務）の内容');
  req(f.deliveryPlace, 'deliveryPlace', '納品先・納品方法');

  const order = parseDate(f.orderDate);
  if (!f.orderDate) out.push({ field: 'orderDate', severity: 'error', message: '「業務委託をした日」が未入力です。' });
  else if (!order) out.push({ field: 'orderDate', severity: 'error', message: '「業務委託をした日」の日付形式が不正です。' });

  const delivery = parseDate(f.deliveryDate);
  if (!f.deliveryDate) out.push({ field: 'deliveryDate', severity: 'error', message: '「納期（給付を受領する期日）」が未入力です。' });
  else if (!delivery) out.push({ field: 'deliveryDate', severity: 'error', message: '「納期」の日付形式が不正です。' });
  else if (order && delivery < order) out.push({ field: 'deliveryDate', severity: 'warn', message: '納期が業務委託をした日より前になっています。' });

  if (f.inspection === 'yes') {
    const insp = parseDate(f.inspectionDate);
    if (!f.inspectionDate) out.push({ field: 'inspectionDate', severity: 'error', message: '検査をする場合は「検査完了日」の明示が必要です。' });
    else if (!insp) out.push({ field: 'inspectionDate', severity: 'error', message: '「検査完了日」の日付形式が不正です。' });
    else if (delivery && insp < delivery) out.push({ field: 'inspectionDate', severity: 'warn', message: '検査完了日が納期より前になっています。' });
  }

  if (!f.fee.trim()) out.push({ field: 'fee', severity: 'error', message: '「報酬の額」が未入力です。' });
  else if (!feeIsConcrete(f.fee)) out.push({ field: 'fee', severity: 'error', message: '報酬が具体的でない可能性があります。額、または具体的な算定方法（単価×数量など）を記載してください。' });

  const pay = parseDate(f.paymentDate);
  if (!f.paymentDate) out.push({ field: 'paymentDate', severity: 'error', message: '「支払期日」が未入力です。「まで」「以内」ではなく具体的な日付で定める必要があります。' });
  else if (!pay) out.push({ field: 'paymentDate', severity: 'error', message: '「支払期日」の日付形式が不正です。' });
  else {
    // 第4条: 給付を受領した日（役務提供を受けた日）から起算して60日以内。
    // 検査の有無にかかわらず受領日起算のため、納期（受領予定日）を起点に目安判定する。
    if (delivery) {
      const d = daysBetween(delivery, pay);
      if (d > 60) out.push({ field: 'paymentDate', severity: 'error', message: `支払期日が納期から${d}日後です。受領日から60日以内のできる限り短い期間内に定める必要があります。` });
      else if (d < 0) out.push({ field: 'paymentDate', severity: 'warn', message: '支払期日が納期より前になっています（前払いの場合は問題ありません）。' });
    } else {
      out.push({ field: 'paymentDate', severity: 'warn', message: '納期が未入力のため、60日ルールの判定ができません。' });
    }
  }

  if (!f.paymentIsCash && !f.paymentMethod.trim()) {
    out.push({ field: 'paymentMethod', severity: 'error', message: '現金以外（電子マネー等）で支払う場合は、支払方法の詳細の明示が必要です。' });
  }
  return out;
}

export interface ApplicabilityInput {
  clientHasEmployees: boolean | null;   // 発注側が従業員を使用しているか
  freelancerHasEmployees: boolean | null; // 受注側（フリーランス）が従業員を使用しているか
  isBusinessToBusiness: boolean | null; // 事業者間の業務委託か（消費者向け取引でないか）
}
export type Applicability = 'applies' | 'not-applies' | 'unknown';

export function judgeApplicability(a: ApplicabilityInput): { result: Applicability; note: string } {
  if (a.freelancerHasEmployees === null || a.isBusinessToBusiness === null) {
    return { result: 'unknown', note: 'すべての質問に回答してください。' };
  }
  if (!a.isBusinessToBusiness) return { result: 'not-applies', note: '事業者間の業務委託でない場合、本法の対象外です。' };
  if (a.freelancerHasEmployees) return { result: 'not-applies', note: '受注側が従業員を使用している場合、特定受託事業者に該当せず、本法（フリーランス新法）の対象外となる可能性があります。下請法（取適法）等の対象となる場合があります。' };
  if (a.clientHasEmployees === null) return { result: 'unknown', note: '発注側の従業員の有無を回答してください。' };
  if (!a.clientHasEmployees) return { result: 'applies', note: '発注側にも従業員がいない場合、第3条（明示）・第4条（支払期日）は対象外で、書面等による明示は努力義務の整理となる点にご注意ください。' };
  return { result: 'applies', note: '第3条（取引条件の明示）・第4条（60日以内の支払期日）等の対象となる可能性が高いです。' };
}

export const PROHIBITED_ITEMS = [
  '受領拒否：納期に納品されたものを、正当な理由なく受け取らない',
  '報酬の減額：発注時に決めた報酬を、正当な理由なく減額する',
  '返品：受領後に、正当な理由なく返品する',
  '買いたたき：通常相場より著しく低い報酬を一方的に決める',
  '購入・利用強制：正当な理由なく、指定の商品やサービスを購入・利用させる',
  '不当な経済上の利益の提供要請：協賛金の提供などを不当に要請する',
  '不当な給付内容の変更・やり直し：費用を負担せず、内容を変更させたりやり直させたりする',
];

export function buildOrderText(f: OrderForm): string {
  const L: string[] = [];
  L.push('【取引条件通知書（発注書）】');
  L.push(`発注事業者: ${f.clientName}`);
  L.push(`受注者（フリーランス）: ${f.freelancerName}`);
  L.push(`業務委託をした日: ${f.orderDate}`);
  L.push(`業務内容（給付の内容）: ${f.content}`);
  L.push(`納期（給付を受領する期日）: ${f.deliveryDate}`);
  L.push(`納品先・納品方法: ${f.deliveryPlace}`);
  if (f.inspection === 'yes') L.push(`検査完了日: ${f.inspectionDate}`);
  L.push(`報酬の額: ${f.fee}`);
  L.push(`支払期日: ${f.paymentDate}`);
  L.push(`支払方法: ${f.paymentIsCash ? '現金（銀行振込）' : f.paymentMethod}`);
  return L.join('\n');
}
