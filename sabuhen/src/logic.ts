// サブ減 コアロジック(DOM非依存・純粋関数のみ)

export type Cycle = "monthly" | "quarterly" | "yearly";
export type Verdict = "cancel" | "review" | "keep" | "unknown";

export interface Subscription {
  id: string;
  name: string;
  /** 1回の請求額(円) */
  price: number;
  cycle: Cycle;
  category: string;
  /** 月あたりの利用回数。未入力は null */
  usesPerMonth: number | null;
  /** 月払い契約で、年払いに切り替えた場合の年額(円)。未入力は null */
  annualPrice: number | null;
  note: string;
}

export const CYCLES: Record<Cycle, { label: string; months: number }> = {
  monthly: { label: "月払い", months: 1 },
  quarterly: { label: "3か月払い", months: 3 },
  yearly: { label: "年払い", months: 12 },
};

export function isCycle(v: unknown): v is Cycle {
  return typeof v === "string" && Object.hasOwn(CYCLES, v);
}

export const CATEGORIES = [
  "動画",
  "音楽",
  "電子書籍・読み放題",
  "ゲーム",
  "クラウド・ストレージ",
  "仕事・学習",
  "健康・フィットネス",
  "ニュース",
  "その他",
] as const;

/** 重複判定の対象外にするカテゴリ */
const NO_DUPLICATE_CATEGORIES = new Set(["その他"]);

export interface Thresholds {
  /** この1回あたりコスト(円)以上なら「解約候補」 */
  cancelCostPerUse: number;
  /** この1回あたりコスト(円)以上なら「要見直し」 */
  reviewCostPerUse: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  cancelCostPerUse: 1000,
  reviewCostPerUse: 500,
};

export function monthlyCost(s: Pick<Subscription, "price" | "cycle">): number {
  return s.price / CYCLES[s.cycle].months;
}

export function yearlyCost(s: Pick<Subscription, "price" | "cycle">): number {
  return monthlyCost(s) * 12;
}

export function totals(subs: Subscription[]): { monthly: number; yearly: number } {
  const monthly = subs.reduce((sum, s) => sum + monthlyCost(s), 0);
  return { monthly, yearly: monthly * 12 };
}

/** 利用1回あたりのコスト。利用回数未入力は null、0回は Infinity */
export function costPerUse(s: Subscription): number | null {
  if (s.usesPerMonth === null) return null;
  if (s.usesPerMonth <= 0) return Infinity;
  return monthlyCost(s) / s.usesPerMonth;
}

/** 年払いに切り替えた場合の年間節約額。月払い以外・未入力・節約にならない場合は null */
export function annualSwitchSavings(s: Subscription): number | null {
  if (s.cycle !== "monthly" || s.annualPrice === null) return null;
  const diff = s.price * 12 - s.annualPrice;
  return diff > 0 ? diff : null;
}

/** 同カテゴリに2件以上ある場合のカテゴリ名一覧 */
export function duplicateCategories(subs: Subscription[]): string[] {
  const count = new Map<string, number>();
  for (const s of subs) {
    if (NO_DUPLICATE_CATEGORIES.has(s.category)) continue;
    count.set(s.category, (count.get(s.category) ?? 0) + 1);
  }
  return [...count.entries()].filter(([, n]) => n >= 2).map(([c]) => c);
}

export interface Assessment {
  verdict: Verdict;
  reasons: string[];
  costPerUse: number | null;
  duplicate: boolean;
  switchSavings: number | null;
}

export function assess(
  s: Subscription,
  all: Subscription[],
  th: Thresholds = DEFAULT_THRESHOLDS,
): Assessment {
  const cpu = costPerUse(s);
  const duplicate = duplicateCategories(all).includes(s.category);
  const reasons: string[] = [];
  let verdict: Verdict = "keep";

  if (monthlyCost(s) === 0) {
    reasons.push("無料のため費用はかかっていません");
  } else if (cpu === null) {
    verdict = "unknown";
    reasons.push("利用回数が未入力のため判定できません");
  } else if (cpu === Infinity) {
    verdict = "cancel";
    reasons.push("今月は利用していません");
  } else if (cpu >= th.cancelCostPerUse) {
    verdict = "cancel";
    reasons.push(`1回あたり約${Math.round(cpu).toLocaleString("ja-JP")}円と高めです`);
  } else if (cpu >= th.reviewCostPerUse) {
    verdict = "review";
    reasons.push(`1回あたり約${Math.round(cpu).toLocaleString("ja-JP")}円です`);
  }

  if (duplicate) {
    reasons.push(`「${s.category}」カテゴリに複数登録があります`);
    if (verdict === "keep") verdict = "review";
  }

  const switchSavings = annualSwitchSavings(s);
  if (switchSavings !== null) {
    reasons.push(`年払いにすると年間${switchSavings.toLocaleString("ja-JP")}円安くなる可能性があります`);
  }

  return { verdict, reasons, costPerUse: cpu, duplicate, switchSavings };
}

/** 選択したサブスクを解約した場合の節約額 */
export function simulateCancel(
  subs: Subscription[],
  cancelIds: Set<string>,
): { monthly: number; yearly: number } {
  return totals(subs.filter((s) => cancelIds.has(s.id)));
}

// ---------- 入力検証 ----------

export const LIMITS = { name: 60, note: 200, maxPrice: 10_000_000, maxUses: 1000 };

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

export function parseNumberField(raw: string): number | null {
  const t = raw.trim().replace(/[,，]/g, "");
  if (t === "") return null;
  // 全角数字対応
  const half = t.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!/^\d+(\.\d+)?$/.test(half)) return NaN;
  return Number(half);
}

export function validateSubscription(
  input: {
    name: string;
    price: string;
    cycle: string;
    category: string;
    usesPerMonth: string;
    annualPrice: string;
    note: string;
  },
  id: string,
): ValidationResult<Subscription> {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name) errors.push("サービス名を入力してください");
  if (name.length > LIMITS.name) errors.push(`サービス名は${LIMITS.name}文字以内です`);

  const price = parseNumberField(input.price);
  if (price === null || Number.isNaN(price)) errors.push("料金は0以上の数値で入力してください");
  else if (price > LIMITS.maxPrice) errors.push("料金が大きすぎます");

  if (!isCycle(input.cycle)) errors.push("支払いサイクルが不正です");

  const uses = parseNumberField(input.usesPerMonth);
  if (uses !== null && (Number.isNaN(uses) || uses > LIMITS.maxUses))
    errors.push(`月の利用回数は0〜${LIMITS.maxUses}の数値で入力してください`);

  const annual = parseNumberField(input.annualPrice);
  if (annual !== null && (Number.isNaN(annual) || annual > LIMITS.maxPrice))
    errors.push("年払い価格は0以上の数値で入力してください");

  const note = input.note.trim();
  if (note.length > LIMITS.note) errors.push(`メモは${LIMITS.note}文字以内です`);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    errors,
    value: {
      id,
      name,
      price: price as number,
      cycle: input.cycle as Cycle,
      category: (CATEGORIES as readonly string[]).includes(input.category) ? input.category : "その他",
      usesPerMonth: uses,
      annualPrice: annual,
      note,
    },
  };
}

// ---------- CSV ----------

export const CSV_HEADER = ["name", "price", "cycle", "category", "usesPerMonth", "annualPrice", "note"];

/** CSVインジェクション対策: 先頭が = + - @ タブ CR の文字列は ' を前置する */
export function csvEscape(v: string): string {
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(subs: Subscription[]): string {
  const rows = subs.map((s) =>
    [
      s.name,
      String(s.price),
      s.cycle,
      s.category,
      s.usesPerMonth === null ? "" : String(s.usesPerMonth),
      s.annualPrice === null ? "" : String(s.annualPrice),
      s.note,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [CSV_HEADER.join(","), ...rows].join("\r\n") + "\r\n";
}

/** RFC4180 準拠の簡易CSVパーサ(引用符・改行・BOM対応) */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

export const MAX_IMPORT_ROWS = 500;

export function fromCsv(
  text: string,
  newId: () => string,
): { subs: Subscription[]; errors: string[] } {
  const rows = parseCsv(text);
  const errors: string[] = [];
  const subs: Subscription[] = [];
  if (rows.length === 0) return { subs, errors: ["CSVが空です"] };
  const header = rows[0].map((h) => h.trim());
  const idx = (k: string) => header.indexOf(k);
  if (idx("name") < 0 || idx("price") < 0 || idx("cycle") < 0) {
    return { subs, errors: ["ヘッダー行に name, price, cycle が必要です"] };
  }
  const body = rows.slice(1);
  if (body.length > MAX_IMPORT_ROWS) {
    errors.push(`行数が多すぎます(最大${MAX_IMPORT_ROWS}行)。先頭${MAX_IMPORT_ROWS}行のみ処理します`);
  }
  body.slice(0, MAX_IMPORT_ROWS).forEach((r, i) => {
    const get = (k: string) => (idx(k) >= 0 ? (r[idx(k)] ?? "") : "");
    // エクスポート時に付けた ' を除去
    const unescape = (v: string) => v.replace(/^'(?=[=+\-@\t\r])/, "");
    const res = validateSubscription(
      {
        name: unescape(get("name")),
        price: get("price"),
        cycle: get("cycle").trim(),
        category: get("category").trim(),
        usesPerMonth: get("usesPerMonth"),
        annualPrice: get("annualPrice"),
        note: unescape(get("note")),
      },
      newId(),
    );
    if (res.ok && res.value) subs.push(res.value);
    else errors.push(`${i + 2}行目: ${res.errors.join(" / ")}`);
  });
  return { subs, errors };
}

// ---------- サンプル ----------

export function sampleData(newId: () => string): Subscription[] {
  const mk = (
    name: string,
    price: number,
    cycle: Cycle,
    category: string,
    usesPerMonth: number | null,
    annualPrice: number | null = null,
  ): Subscription => ({ id: newId(), name, price, cycle, category, usesPerMonth, annualPrice, note: "" });
  // 金額は説明用のダミー値(実在サービスの現行料金ではありません)
  return [
    mk("動画サービスA", 990, "monthly", "動画", 12, 9900),
    mk("動画サービスB", 1490, "monthly", "動画", 1),
    mk("音楽サービスC", 1080, "monthly", "音楽", 40),
    mk("クラウド容量D", 14400, "yearly", "クラウド・ストレージ", 30),
    mk("読み放題E", 550, "monthly", "電子書籍・読み放題", 0),
    mk("フィットネスF", 7700, "monthly", "健康・フィットネス", 2),
  ];
}
