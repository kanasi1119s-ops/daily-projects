export type Mode = "individual" | "monthly";

export interface PaymentInput {
  receivedDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  mode: Mode;
  closingDay: number; // 1-31, monthly mode only (31 = 月末)
}

export interface PaymentResult {
  ok: boolean;
  baseDate: string; // 起算に用いる日
  limitDate: string; // 60日目(起算日を1日目と数える)
  daysUsed: number; // 起算日を1日目とした支払期日までの日数
  message: string;
}

const DAY = 86400000;

export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return d;
}

export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 締め日(1-31)を、dが属する期間の末日に解決する。31は月末。 */
export function periodEnd(d: Date, closingDay: number): Date {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const lastOf = (yy: number, mm: number) => new Date(Date.UTC(yy, mm + 1, 0));
  const clamp = (yy: number, mm: number) => {
    const last = lastOf(yy, mm).getUTCDate();
    return new Date(Date.UTC(yy, mm, Math.min(closingDay, last)));
  };
  const thisClose = clamp(y, mo);
  return d.getTime() <= thisClose.getTime() ? thisClose : clamp(y, mo + 1);
}

export function checkPayment(input: PaymentInput): PaymentResult | { error: string } {
  const recv = parseDate(input.receivedDate);
  const due = parseDate(input.dueDate);
  if (!recv) return { error: "受領日を正しく入力してください。" };
  if (!due) return { error: "支払期日を正しく入力してください。" };
  if (input.mode === "monthly" && !(Number.isInteger(input.closingDay) && input.closingDay >= 1 && input.closingDay <= 31)) {
    return { error: "締め日は1〜31で指定してください(31=月末)。" };
  }
  const base = input.mode === "monthly" ? periodEnd(recv, input.closingDay) : recv;
  const limit = new Date(base.getTime() + 59 * DAY);
  const daysUsed = Math.round((due.getTime() - base.getTime()) / DAY) + 1;
  if (due.getTime() < recv.getTime()) {
    return { error: "支払期日が受領日より前になっています。" };
  }
  const ok = due.getTime() <= limit.getTime();
  return {
    ok,
    baseDate: fmt(base),
    limitDate: fmt(limit),
    daysUsed,
    message: ok
      ? `支払期日は起算日から${daysUsed}日目で、60日以内に収まっています。`
      : `支払期日は起算日から${daysUsed}日目で、60日を${daysUsed - 60}日超過しています。${fmt(limit)}以前に設定する必要があります。`,
  };
}

export interface Terms {
  clientName: string;
  freelancerName: string;
  work: string;
  fee: string;
  dueDate: string;
  deliveryDate: string;
  deliveryPlace: string;
  inspectionDate: string;
  paymentMethod: string;
}

export const REQUIRED: (keyof Terms)[] = [
  "clientName",
  "freelancerName",
  "work",
  "fee",
  "dueDate",
  "deliveryDate",
  "paymentMethod",
];

export const LABELS: Record<keyof Terms, string> = {
  clientName: "発注事業者の名称",
  freelancerName: "フリーランスの名称",
  work: "業務の内容",
  fee: "報酬の額(算定方法でも可)",
  dueDate: "報酬の支払期日",
  deliveryDate: "給付の提供期日(納期)",
  deliveryPlace: "給付の提供場所",
  inspectionDate: "検収完了日(検査がある場合)",
  paymentMethod: "報酬の支払方法",
};

export function missingFields(t: Terms): (keyof Terms)[] {
  return REQUIRED.filter((k) => !t[k].trim());
}

export function renderTerms(t: Terms): string {
  const v = (s: string, fallback = "(該当なし)") => s.trim() || fallback;
  return [
    "【取引条件の明示】",
    `発注事業者: ${v(t.clientName, "(未入力)")}`,
    `受注者(フリーランス): ${v(t.freelancerName, "(未入力)")}`,
    "",
    `1. 業務の内容: ${v(t.work, "(未入力)")}`,
    `2. 報酬の額: ${v(t.fee, "(未入力)")}`,
    `3. 報酬の支払期日: ${v(t.dueDate, "(未入力)")}`,
    `4. 給付の提供期日: ${v(t.deliveryDate, "(未入力)")}`,
    `5. 給付の提供場所: ${v(t.deliveryPlace)}`,
    `6. 検収完了日: ${v(t.inspectionDate)}`,
    `7. 報酬の支払方法: ${v(t.paymentMethod, "(未入力)")}`,
  ].join("\n");
}
