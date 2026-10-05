export interface NoticeInput {
  clientName: string;
  freelancerName: string;
  contractDate: string; // YYYY-MM-DD
  workDescription: string;
  deliveryDate: string; // 納期 YYYY-MM-DD
  deliveryPlace: string;
  inspection: boolean; // 検収あり
  inspectionDate: string;
  fee: string; // 金額 or 算定方法
  paymentDate: string; // 支払期日 YYYY-MM-DD
  paymentMethod: string; // 現金以外の場合のみ記載
}

export const emptyInput = (): NoticeInput => ({
  clientName: "", freelancerName: "", contractDate: "", workDescription: "",
  deliveryDate: "", deliveryPlace: "", inspection: false, inspectionDate: "",
  fee: "", paymentDate: "", paymentMethod: "",
});

export interface Issue { field: keyof NoticeInput; message: string; }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt : null;
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string | null {
  const d = parseDate(s);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
}

/** 受領日（初日算入）から60日目 = 受領日 + 59日。 */
export function paymentDeadline(receiptDate: string): string | null {
  return addDays(receiptDate, 59);
}

/** 第3条の明示事項の不足チェック */
export function validateNotice(i: NoticeInput): Issue[] {
  const out: Issue[] = [];
  const req = (f: keyof NoticeInput, label: string) => {
    if (typeof i[f] === "string" && !(i[f] as string).trim()) out.push({ field: f, message: `${label}が未記入です` });
  };
  req("clientName", "発注事業者の名称");
  req("freelancerName", "フリーランスの名称");
  req("workDescription", "業務の内容");
  req("fee", "報酬の額（または算定方法）");
  req("deliveryPlace", "給付の提供場所");

  const dateField = (f: "contractDate" | "deliveryDate" | "paymentDate" | "inspectionDate", label: string) => {
    if (!i[f]) out.push({ field: f, message: `${label}が未記入です` });
    else if (!parseDate(i[f])) out.push({ field: f, message: `${label}の日付形式が正しくありません` });
  };
  dateField("contractDate", "業務委託をした日");
  dateField("deliveryDate", "給付の期日（納期）");
  dateField("paymentDate", "報酬の支払期日");
  if (i.inspection) dateField("inspectionDate", "検査完了日");

  const c = parseDate(i.contractDate), p = parseDate(i.paymentDate), d = parseDate(i.deliveryDate);
  if (c && d && d < c) out.push({ field: "deliveryDate", message: "納期が委託日より前になっています" });
  const ins = parseDate(i.inspectionDate);
  if (i.inspection && d && ins && ins < d) out.push({ field: "inspectionDate", message: "検査完了日が納期より前になっています" });
  if (p && c && p < c) out.push({ field: "paymentDate", message: "支払期日が委託日より前になっています" });
  return out;
}

export interface PaymentCheck { ok: boolean; deadline: string | null; message: string; }

/** 第4条: 支払期日が受領日から60日以内か */
export function checkPaymentDate(receiptDate: string, paymentDate: string): PaymentCheck {
  const deadline = paymentDeadline(receiptDate);
  const p = parseDate(paymentDate);
  if (!deadline || !p) return { ok: false, deadline, message: "日付を正しく入力してください" };
  if (p < parseDate(receiptDate)!) return { ok: false, deadline, message: "支払期日が受領日より前です" };
  const ok = formatDate(p) <= deadline;
  return { ok, deadline, message: ok ? `受領日から60日以内です（上限 ${deadline}）` : `60日を超えています。上限は ${deadline} です` };
}

const jp = (s: string) => {
  const d = parseDate(s);
  return d ? `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日` : s;
};

/** 通知書の本文テキストを生成 */
export function renderNotice(i: NoticeInput): string {
  const lines = [
    "取引条件通知書",
    "",
    `${i.freelancerName} 殿`,
    "",
    `${i.clientName}（以下「発注者」）は、${jp(i.contractDate)}付で、下記のとおり業務を委託します。`,
    "",
    `1. 発注事業者の名称: ${i.clientName}`,
    `2. 受託者（フリーランス）の名称: ${i.freelancerName}`,
    `3. 業務委託をした日: ${jp(i.contractDate)}`,
    `4. 業務の内容: ${i.workDescription}`,
    `5. 給付の期日: ${jp(i.deliveryDate)}`,
    `6. 給付の提供場所: ${i.deliveryPlace}`,
  ];
  if (i.inspection) lines.push(`7. 検査完了日: ${jp(i.inspectionDate)}`);
  lines.push(`${i.inspection ? 8 : 7}. 報酬の額: ${i.fee}`);
  lines.push(`${i.inspection ? 9 : 8}. 報酬の支払期日: ${jp(i.paymentDate)}`);
  if (i.paymentMethod.trim()) lines.push(`${i.inspection ? 10 : 9}. 支払方法（現金以外）: ${i.paymentMethod}`);
  lines.push("", "※本書は取引条件の明示を目的とした雛形です。法的助言ではありません。");
  return lines.join("\n");
}
