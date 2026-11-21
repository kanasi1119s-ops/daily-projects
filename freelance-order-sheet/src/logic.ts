export interface OrderForm {
  clientName: string;
  freelancerName: string;
  orderDate: string;        // 業務委託をした日 YYYY-MM-DD
  description: string;      // 業務内容
  deliveryDate: string;     // 給付を受領/役務提供を受ける日
  deliveryPlace: string;    // 場所
  inspectionDate: string;   // 検査完了日(任意)
  amount: string;           // 報酬額(数字文字列)
  amountNote: string;       // 算定方法など(任意)
  dueDate: string;          // 支払期日
  payMethod: string;        // 支払方法(任意)
  taxMode: '' | '税込' | '税別';
}

export const emptyForm: OrderForm = {
  clientName: '', freelancerName: '', orderDate: '', description: '',
  deliveryDate: '', deliveryPlace: '', inspectionDate: '', amount: '',
  amountNote: '', dueDate: '', payMethod: '', taxMode: '',
};

export interface Issue { level: 'error' | 'warn'; field: keyof OrderForm | 'general'; message: string }

const MS_DAY = 86400000;

export function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function daysBetween(from: string, to: string): number | null {
  const a = parseDate(from), b = parseDate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
}

/** 受領日(提供日)を1日目として数えた60日目(=受領日+59日)。保守的に初日算入で計算する */
export function maxDueDate(deliveryDate: string): string | null {
  const a = parseDate(deliveryDate);
  if (!a) return null;
  return new Date(a.getTime() + 59 * MS_DAY).toISOString().slice(0, 10);
}

export function parseAmount(s: string): number | null {
  const t = s.replace(/[,，\s円¥]/g, '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export function formatDateJa(s: string): string {
  const d = parseDate(s);
  return d ? `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日` : s;
}

export function formatYen(n: number): string {
  return n.toLocaleString('ja-JP') + '円';
}

export function validate(f: OrderForm): Issue[] {
  const out: Issue[] = [];
  const req = (k: keyof OrderForm, label: string) => {
    if (!f[k].trim()) out.push({ level: 'error', field: k, message: `${label}は必須の明示事項です` });
  };
  req('clientName', '発注事業者の名称');
  req('freelancerName', 'フリーランスの名称');
  req('description', '業務の内容');
  req('deliveryPlace', '納品(提供)の場所');
  for (const [k, label] of [['orderDate', '業務委託をした日'], ['deliveryDate', '納品(提供)日'], ['dueDate', '報酬の支払期日']] as const) {
    if (!f[k]) out.push({ level: 'error', field: k, message: `${label}は必須の明示事項です` });
    else if (!parseDate(f[k])) out.push({ level: 'error', field: k, message: `${label}の日付形式が不正です` });
  }
  if (f.inspectionDate && !parseDate(f.inspectionDate)) out.push({ level: 'error', field: 'inspectionDate', message: '検査完了日の日付形式が不正です' });
  if (!f.amount.trim()) {
    if (!f.amountNote.trim()) out.push({ level: 'error', field: 'amount', message: '報酬の額(または具体的な算定方法)は必須です' });
  } else {
    const n = parseAmount(f.amount);
    if (n === null) out.push({ level: 'error', field: 'amount', message: '報酬額は数字で入力してください' });
    else if (n === 0) out.push({ level: 'warn', field: 'amount', message: '報酬額が0円になっています' });
  }
  const od = daysBetween(f.orderDate, f.deliveryDate);
  if (od !== null && od < 0) out.push({ level: 'warn', field: 'deliveryDate', message: '納品日が委託日より前になっています' });
  if (f.deliveryDate && f.dueDate) {
    const lim = maxDueDate(f.deliveryDate);
    const diff = daysBetween(f.deliveryDate, f.dueDate);
    if (diff !== null && diff < 0) out.push({ level: 'warn', field: 'dueDate', message: '支払期日が納品日より前になっています' });
    if (lim && diff !== null && diff > 59) {
      out.push({ level: 'warn', field: 'dueDate', message: `支払期日が納品(提供)日から60日を超えています。60日以内(目安: ${lim}まで)で定める必要があります` });
    }
  }
  if (f.inspectionDate && f.deliveryDate) {
    const d = daysBetween(f.deliveryDate, f.inspectionDate);
    if (d !== null && d < 0) out.push({ level: 'warn', field: 'inspectionDate', message: '検査完了日が納品日より前です' });
  }
  return out;
}

export function render(f: OrderForm): string {
  const amount = parseAmount(f.amount);
  const amountLine = [amount !== null ? formatYen(amount) + (f.taxMode ? `(${f.taxMode})` : '') : '', f.amountNote.trim()].filter(Boolean).join(' / ');
  let n = 0;
  const item = (title: string, body: string[]) => lines.push(`${++n}. ${title}`, ...body.map(l => '   ' + l));
  const lines: string[] = ['取引条件明示書', '', `発注事業者: ${f.clientName}`, `受注者(フリーランス): ${f.freelancerName}`, ''];
  item('業務委託をした日', [formatDateJa(f.orderDate)]);
  item('業務の内容', f.description.split('\n'));
  item('納品(給付の受領・役務の提供を受ける)日', [formatDateJa(f.deliveryDate)]);
  item('納品(提供)場所', [f.deliveryPlace]);
  if (f.inspectionDate) item('検査完了日', [formatDateJa(f.inspectionDate)]);
  item('報酬の額', [amountLine || '(未記入)']);
  item('報酬の支払期日', [formatDateJa(f.dueDate)]);
  if (f.payMethod.trim()) item('報酬の支払方法', [f.payMethod]);
  lines.push('', '※本書面は、取引条件を書面等で明示するためのものです。');
  return lines.join('\n');
}

export const prohibitedChecklist = [
  '正当な理由なく、納品物の受領を拒否していない',
  '発注後に、報酬を一方的に減額していない',
  '納品後に、正当な理由なく返品していない',
  '通常相場より著しく低い報酬を一方的に決めていない',
  '不当な修正・やり直しを、費用負担なしで求めていない',
  '報酬の支払が、納品(提供)日から60日以内になっている',
];
