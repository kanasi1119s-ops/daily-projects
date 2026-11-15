/**
 * 支払期日（受領日から60日以内）の計算。
 * 日付は "YYYY-MM-DD" 文字列、内部はUTC日付で扱いタイムゾーンの影響を受けない。
 * 受領日を1日目として数える（初日算入・安全側）。
 */

export const PAYMENT_LIMIT_DAYS = 60;
const DAY = 86_400_000;

export function parseDate(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t;
}

export function formatDate(t: number): string {
  const d = new Date(t);
  const wd = '日月火水木金土'[d.getUTCDay()];
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}（${wd}）`;
}

/** 受領日を1日目として数えた、支払期限（60日目）。 */
export function paymentDeadline(receipt: string): number | null {
  const t = parseDate(receipt);
  return t === null ? null : t + (PAYMENT_LIMIT_DAYS - 1) * DAY;
}

/** 受領日を1日目として、支払日が何日目か。 */
export function elapsedDays(receipt: string, pay: string): number | null {
  const r = parseDate(receipt);
  const p = parseDate(pay);
  if (r === null || p === null) return null;
  return Math.round((p - r) / DAY) + 1;
}

export interface PaymentCheck {
  ok: boolean;
  days: number;
  deadline: string;
  message: string;
}

export function checkPayment(receipt: string, pay: string): PaymentCheck | null {
  const days = elapsedDays(receipt, pay);
  const dl = paymentDeadline(receipt);
  if (days === null || dl === null) return null;
  if (days < 1) {
    return { ok: false, days, deadline: formatDate(dl), message: '支払予定日が受領日より前になっています。日付を確認してください。' };
  }
  const ok = days <= PAYMENT_LIMIT_DAYS;
  return {
    ok,
    days,
    deadline: formatDate(dl),
    message: ok
      ? `受領日から${days}日目で、60日以内に収まっています。`
      : `受領日から${days}日目で、60日を${days - PAYMENT_LIMIT_DAYS}日超過しています（支払遅延のおそれ）。`,
  };
}

export interface Terms {
  /** 締め日：1〜28、0 は月末 */
  closingDay: number;
  /** 締め月から何か月後に支払うか（0=当月, 1=翌月, 2=翌々月） */
  monthsLater: number;
  /** 支払日：1〜28、0 は月末 */
  payDay: number;
}

function lastDay(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

function dateOf(y: number, m0: number, day: number): number {
  // m0 は範囲外でも Date.UTC が繰り上げ処理する
  const norm = new Date(Date.UTC(y, m0, 1));
  const yy = norm.getUTCFullYear();
  const mm = norm.getUTCMonth();
  return Date.UTC(yy, mm, day === 0 ? lastDay(yy, mm) : Math.min(day, lastDay(yy, mm)));
}

/** ある受領日に対する、締め日・支払サイトに基づく支払日 */
export function payDateFor(receipt: number, terms: Terms): number {
  const d = new Date(receipt);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const closeThisMonth = dateOf(y, m, terms.closingDay);
  const closeMonth = receipt <= closeThisMonth ? m : m + 1;
  return dateOf(y, closeMonth + terms.monthsLater, terms.payDay);
}

export interface TermsResult {
  worstDays: number;
  worstReceipt: string;
  ok: boolean;
}

/** 受領日が最も不利な日（締め直後）に当たった場合の経過日数を、1年分走査して求める。 */
export function worstCaseDays(terms: Terms, startYear = 2026): TermsResult {
  let worst = 0;
  let worstReceipt = 0;
  const start = Date.UTC(startYear, 0, 1);
  for (let i = 0; i < 366; i++) {
    const r = start + i * DAY;
    const days = Math.round((payDateFor(r, terms) - r) / DAY) + 1;
    if (days > worst) {
      worst = days;
      worstReceipt = r;
    }
  }
  return { worstDays: worst, worstReceipt: formatDate(worstReceipt), ok: worst <= PAYMENT_LIMIT_DAYS };
}
