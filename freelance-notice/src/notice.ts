export interface NoticeInput {
  clientName: string;
  freelancerName: string;
  orderDate: string; // YYYY-MM-DD
  description: string;
  deliveryDate: string; // 給付を受領する日 / 役務提供を受ける日
  deliveryPlace: string;
  hasInspection: boolean;
  inspectionDate: string;
  amount: string; // 数字のみ(円)
  taxMode: "incl" | "excl" | ""; // 税込 / 税別
  amountNote: string; // 算定方法など(金額が確定できない場合)
  dueDate: string; // 支払期日
  paymentMethod: string; // 例: 銀行振込
  nonCashDetail: string; // 現金以外で支払う場合の明示事項
}

export const emptyInput: NoticeInput = {
  clientName: "", freelancerName: "", orderDate: "", description: "",
  deliveryDate: "", deliveryPlace: "", hasInspection: false, inspectionDate: "",
  amount: "", taxMode: "incl", amountNote: "", dueDate: "", paymentMethod: "銀行振込", nonCashDetail: "",
};

export interface Issue { level: "error" | "warn"; field: keyof NoticeInput | "form"; message: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

const DAY = 86_400_000;

export function validate(i: NoticeInput): Issue[] {
  const out: Issue[] = [];
  const req = (f: keyof NoticeInput, label: string) => {
    if (!String(i[f]).trim()) out.push({ level: "error", field: f, message: `${label}は必須項目です` });
  };
  req("clientName", "発注者(業務委託事業者)の名称");
  req("freelancerName", "受注者(フリーランス)の名称");
  req("description", "業務内容(給付の内容)");
  req("deliveryPlace", "納品・提供場所");
  req("paymentMethod", "報酬の支払方法");

  for (const [f, label] of [["orderDate", "発注日"], ["deliveryDate", "納品(提供)日"], ["dueDate", "支払期日"]] as const) {
    if (!i[f]) out.push({ level: "error", field: f, message: `${label}は必須項目です` });
    else if (!parseDate(i[f])) out.push({ level: "error", field: f, message: `${label}の日付形式が不正です` });
  }
  if (i.hasInspection) {
    if (!i.inspectionDate) out.push({ level: "error", field: "inspectionDate", message: "検査を行う場合は検収完了日が必須です" });
    else if (!parseDate(i.inspectionDate)) out.push({ level: "error", field: "inspectionDate", message: "検収完了日の日付形式が不正です" });
  }

  const amt = i.amount.trim();
  if (!amt && !i.amountNote.trim()) {
    out.push({ level: "error", field: "amount", message: "報酬額、または報酬の算定方法のいずれかが必須です" });
  } else if (amt && !/^\d+$/.test(amt)) {
    out.push({ level: "error", field: "amount", message: "報酬額は半角数字のみで入力してください" });
  } else if (amt && (Number(amt) <= 0 || amt.length > 12)) {
    out.push({ level: "error", field: "amount", message: "報酬額は1円以上、12桁以内で入力してください" });
  }

  if (/現金|銀行|振込/.test(i.paymentMethod) === false && !i.nonCashDetail.trim()) {
    out.push({ level: "warn", field: "nonCashDetail", message: "現金(銀行振込を含む)以外で支払う場合は、支払方法の詳細の明示が必要です" });
  }

  const order = parseDate(i.orderDate), deliv = parseDate(i.deliveryDate), due = parseDate(i.dueDate);
  const base = deliv; // 60日の起算は給付の受領日
  if (order && deliv && deliv.getTime() < order.getTime())
    out.push({ level: "warn", field: "deliveryDate", message: "納品日が発注日より前になっています" });
  const insp = i.hasInspection ? parseDate(i.inspectionDate) : null;
  if (insp && deliv && insp.getTime() < deliv.getTime())
    out.push({ level: "warn", field: "inspectionDate", message: "検収完了日が納品日より前になっています" });
  if (due && deliv && due.getTime() < deliv.getTime())
    out.push({ level: "warn", field: "dueDate", message: "支払期日が納品日より前になっています" });
  if (due && base && (due.getTime() - base.getTime()) / DAY > 60)
    out.push({ level: "warn", field: "dueDate", message: "支払期日が納品(受領)日から60日を超えています。法律上は受領日から60日以内の支払期日設定が求められます" });
  return out;
}

export const hasError = (issues: Issue[]) => issues.some((x) => x.level === "error");

const fmtDate = (s: string) => {
  const d = parseDate(s);
  return d ? `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日` : s;
};
export const fmtYen = (s: string) => `${Number(s).toLocaleString("ja-JP")}円`;

export function render(i: NoticeInput): string {
  const lines: string[] = [];
  lines.push("取引条件明示書(発注書)", "");
  lines.push(`発注日: ${fmtDate(i.orderDate)}`, "");
  lines.push(`業務委託事業者(発注者): ${i.clientName}`);
  lines.push(`特定受託事業者(受注者): ${i.freelancerName}`, "");
  lines.push("下記のとおり業務を委託します。", "");
  lines.push("1. 業務の内容(給付の内容)", i.description.trim(), "");
  lines.push(`2. 給付を受領する日/役務の提供を受ける日: ${fmtDate(i.deliveryDate)}`);
  lines.push(`3. 給付を受領する場所/役務の提供を受ける場所: ${i.deliveryPlace}`);
  if (i.hasInspection) lines.push(`4. 検査完了日(検収完了日): ${fmtDate(i.inspectionDate)}`);
  else lines.push("4. 検査: 行わない");
  const amt = i.amount.trim();
  lines.push(`5. 報酬の額: ${amt ? fmtYen(amt) + (i.taxMode === "incl" ? "(税込)" : i.taxMode === "excl" ? "(税別)" : "") : "下記算定方法による"}`);
  if (i.amountNote.trim()) lines.push(`   報酬の算定方法・備考: ${i.amountNote.trim()}`);
  lines.push(`6. 報酬の支払期日: ${fmtDate(i.dueDate)}`);
  lines.push(`7. 報酬の支払方法: ${i.paymentMethod}`);
  if (i.nonCashDetail.trim()) lines.push(`8. 現金以外の方法で支払う場合の明示事項: ${i.nonCashDetail.trim()}`);
  lines.push("", "※本書面は取引条件の明示を目的とするものです。");
  return lines.join("\n");
}
