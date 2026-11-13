/** 請求書チェッカーのコアロジック（UI非依存・整数演算のみ） */

export type Rounding = "floor" | "round" | "ceil";
export type Rate = 10 | 8;

export interface Line {
  amount: number; // 円（整数）。税込/税抜は InvoiceInput.taxIncluded に従う
  rate: Rate;
}

export interface RateSummary {
  rate: Rate;
  subtotal: number; // 入力額の合計
  tax: number; // 消費税額（円）
  excl: number; // 税抜合計
  incl: number; // 税込合計
}

export interface InvoiceResult {
  byRate: RateSummary[];
  totalExcl: number;
  totalTax: number;
  totalIncl: number;
}

/** 非負整数 n / d を指定方式で整数化（整数のみで計算し浮動小数誤差を避ける） */
export function divRound(n: number, d: number, mode: Rounding): number {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d <= 0) {
    throw new Error("整数のみ指定できます");
  }
  if (n < 0) return -divRound(-n, d, mode);
  switch (mode) {
    case "floor":
      return Math.floor(n / d);
    case "ceil":
      return Math.floor((n + d - 1) / d);
    case "round":
      return Math.floor((2 * n + d) / (2 * d));
  }
}

/**
 * 適格請求書の税額計算: 税率ごとに1請求書につき1回だけ端数処理する。
 */
export function calcInvoice(
  lines: Line[],
  taxIncluded: boolean,
  mode: Rounding,
): InvoiceResult {
  const rates: Rate[] = [10, 8];
  const byRate: RateSummary[] = [];
  for (const rate of rates) {
    const targets = lines.filter((l) => l.rate === rate);
    if (targets.length === 0) continue;
    for (const l of targets) {
      if (!Number.isInteger(l.amount)) throw new Error("金額は整数(円)で入力してください");
    }
    const subtotal = targets.reduce((s, l) => s + l.amount, 0);
    if (!Number.isSafeInteger(subtotal * 100)) throw new Error("金額が大きすぎます");
    let tax: number, excl: number, incl: number;
    if (taxIncluded) {
      tax = divRound(subtotal * rate, 100 + rate, mode);
      incl = subtotal;
      excl = subtotal - tax;
    } else {
      tax = divRound(subtotal * rate, 100, mode);
      excl = subtotal;
      incl = subtotal + tax;
    }
    byRate.push({ rate, subtotal, tax, excl, incl });
  }
  return {
    byRate,
    totalExcl: byRate.reduce((s, r) => s + r.excl, 0),
    totalTax: byRate.reduce((s, r) => s + r.tax, 0),
    totalIncl: byRate.reduce((s, r) => s + r.incl, 0),
  };
}

export type TCheck =
  | { ok: true; kind: "corporate"; number: string }
  | { ok: false; reason: string; kind?: "individual" };

/** 全角→半角、空白・ハイフン除去 */
export function normalizeT(input: string): string {
  return input
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-ー－―]/g, "")
    .toUpperCase();
}

/** 法人番号のチェックデジット検証（国税庁公表の算式） */
export function isValidCorporateNumber(num13: string): boolean {
  if (!/^\d{13}$/.test(num13)) return false;
  const check = Number(num13[0]);
  const body = num13.slice(1); // 12桁
  let sum = 0;
  for (let n = 1; n <= 12; n++) {
    const digit = Number(body[12 - n]); // 最下位が n=1
    sum += digit * (n % 2 === 1 ? 1 : 2);
  }
  return 9 - (sum % 9) === check;
}

/**
 * 登録番号の形式チェック。
 * 法人は「T+法人番号」のためチェックデジットまで検証可能。
 * 個人事業主等は法人番号でないためオフラインでは検証不可（国税庁公表サイトで要確認）。
 * ※ 形式が正しくても「登録済み」を意味しない。
 */
export function checkTNumber(input: string): TCheck {
  const s = normalizeT(input);
  if (!s) return { ok: false, reason: "未入力です" };
  if (!/^T\d{13}$/.test(s)) {
    return { ok: false, reason: "「T」＋数字13桁の形式ではありません" };
  }
  const num = s.slice(1);
  if (isValidCorporateNumber(num)) return { ok: true, kind: "corporate", number: s };
  return {
    ok: false,
    kind: "individual",
    reason:
      "法人番号のチェックデジットと一致しません。個人事業主等の番号は形式のみ正しい可能性があります。誤入力でないか国税庁の公表サイトで確認してください",
  };
}

/** 仕入税額控除の経過措置（免税事業者等からの課税仕入） */
export function transitionalRate(date: string): number | null {
  // date: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return null;
  if (date < "2023-10-01") return 100; // 制度開始前
  if (date <= "2026-09-30") return 80;
  if (date <= "2029-09-30") return 50;
  return 0;
}

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
}

export const REQUIRED_ITEMS: ChecklistItem[] = [
  { id: "issuer", label: "発行事業者の氏名または名称", hint: "請求書を出す側" },
  { id: "tno", label: "登録番号（T＋13桁）", hint: "形式チェックは上のツールで" },
  { id: "date", label: "取引年月日", hint: "請求日ではなく取引日" },
  { id: "content", label: "取引内容（軽減税率対象品目はその旨）", hint: "8%品目に「※」等の表示" },
  { id: "rate", label: "税率ごとに区分した合計額（税抜または税込）と適用税率", hint: "10%・8%を分ける" },
  { id: "tax", label: "税率ごとの消費税額等", hint: "1請求書につき税率ごとに1回の端数処理" },
  { id: "recipient", label: "書類の交付を受ける事業者の氏名または名称", hint: "宛名" },
];
