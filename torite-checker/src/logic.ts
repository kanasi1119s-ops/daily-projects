// 日付は全てUTC基準の「日」単位で扱い、タイムゾーン/夏時間の影響を排除する。
const DAY = 86_400_000;

export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}
export function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}
export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

/** 受領日を起算日(1日目)に含めた60日目。保守的(早い)側の日付。 */
export function latestPaymentDate(receipt: Date, limit = 60): Date {
  return addDays(receipt, limit - 1);
}

export type PaymentCheck = {
  deadline: Date;
  daysFromReceipt: number; // 初日算入
  ok: boolean;
  overdueDays: number;
  interest: number;
};

export function checkPayment(receipt: Date, planned: Date, amount: number, rate = 0.146): PaymentCheck {
  const deadline = latestPaymentDate(receipt);
  const daysFromReceipt = diffDays(receipt, planned) + 1;
  const overdueDays = Math.max(0, diffDays(deadline, planned));
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const interest = Math.floor((safeAmount * rate * overdueDays) / 365);
  return { deadline, daysFromReceipt, ok: daysFromReceipt <= 60, overdueDays, interest };
}

function lastDayOfMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

export type ClosingResult = { maxDays: number; worstReceipt: Date; worstPayment: Date; ok: boolean };

/**
 * 締め日(0=末日)・支払月(1=翌月,2=翌々月)・支払日(0=末日)の運用で、
 * 指定年の全受領日を走査して最長の日数(初日算入)を求める。
 */
export function closingWorstCase(closing: number, monthsLater: number, payDay: number, year: number): ClosingResult {
  let best: ClosingResult | null = null;
  for (let t = Date.UTC(year, 0, 1); t <= Date.UTC(year, 11, 31); t += DAY) {
    const d = new Date(t);
    const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
    const closeDay = closing === 0 ? lastDayOfMonth(y, m) : Math.min(closing, lastDayOfMonth(y, m));
    const closeMonthIdx = day <= closeDay ? m : m + 1; // 月跨ぎはDate.UTCが吸収
    const target = new Date(Date.UTC(y, closeMonthIdx + monthsLater, 1));
    const ty = target.getUTCFullYear(), tm = target.getUTCMonth();
    const pd = payDay === 0 ? lastDayOfMonth(ty, tm) : Math.min(payDay, lastDayOfMonth(ty, tm));
    const pay = new Date(Date.UTC(ty, tm, pd));
    const days = diffDays(d, pay) + 1;
    if (!best || days > best.maxDays) best = { maxDays: days, worstReceipt: d, worstPayment: pay, ok: days <= 60 };
  }
  return best!;
}

// ---------- 適用判定 ----------
export type DealType = "A" | "B";
// A: 製造委託・修理委託・プログラム作成(情報成果物)・運送/物品倉庫保管/情報処理の役務提供 等
// B: A以外の情報成果物作成委託・役務提供委託
export type ApplicInput = {
  type: DealType;
  clientCapitalMan: number | null; // 委託者の資本金(万円)。個人・無資本は0
  clientEmployees: number;
  contractorIndividual: boolean; // 受託者が個人(法人格なし)
  contractorCapitalMan: number;
  contractorEmployees: number;
};
export type ApplicResult = { torite: boolean; toriteReasons: string[]; freelance: boolean; freelanceReasons: string[] };

export function judgeApplicability(i: ApplicInput): ApplicResult {
  const big = i.type === "A" ? 30000 : 5000; // 3億 / 5千万
  const empLimit = i.type === "A" ? 300 : 100;
  const cap = i.clientCapitalMan ?? 0;
  const cc = i.contractorIndividual ? 0 : i.contractorCapitalMan;
  const reasons: string[] = [];
  if (cap > big && cc <= big) reasons.push(`資本金基準: 委託者${cap}万円 > ${big}万円 かつ 受託者${cc}万円 ≤ ${big}万円`);
  if (cap > 1000 && cap <= big && cc <= 1000) reasons.push(`資本金基準: 委託者が1000万円超${big}万円以下 かつ 受託者${cc}万円 ≤ 1000万円`);
  if (i.clientEmployees > empLimit && i.contractorEmployees <= empLimit)
    reasons.push(`従業員基準: 委託者${i.clientEmployees}人 > ${empLimit}人 かつ 受託者${i.contractorEmployees}人 ≤ ${empLimit}人`);
  const fl: string[] = [];
  const freelance = i.contractorEmployees === 0; // 従業員を使用しない個人/一人法人
  if (freelance) fl.push("受託者に従業員がいない(個人、または代表者のみの法人)ため、フリーランス法の対象となり得ます");
  return { torite: reasons.length > 0, toriteReasons: reasons, freelance, freelanceReasons: fl };
}
