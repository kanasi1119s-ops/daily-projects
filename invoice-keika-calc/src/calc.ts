import { ANNUAL_CAP_YEN, ratioFor } from "./schedule";

export type TaxRate = 10 | 8;

export interface Entry {
  date: string; // YYYY-MM-DD
  supplier: string;
  amount: number; // 税込・円
  rate: TaxRate;
  registered: boolean; // 取引先がインボイス発行事業者か
}

export interface LineResult extends Entry {
  tax: number; // 税込金額に含まれる消費税額（国税+地方税）
  ratio: number;
  ratioLabel: string;
  deductible: number;
  nonDeductible: number;
  capExceeded: boolean;
}

export interface Summary {
  lines: LineResult[];
  totalTax: number;
  totalDeductible: number;
  totalNonDeductible: number;
  nonRegisteredTotal: number;
  capWarning: boolean;
}

export function taxIncluded(amount: number, rate: TaxRate): number {
  return Math.floor((amount * rate) / (100 + rate));
}

/** 入力順を保ったまま、取引日順に上限(1億円)を適用して計算する。 */
export function calculate(entries: Entry[]): Summary {
  const order = entries.map((_, i) => i).sort((a, b) => entries[a].date.localeCompare(entries[b].date) || a - b);
  const results: LineResult[] = new Array(entries.length);
  let cumulative = 0;
  let capWarning = false;
  for (const i of order) {
    const e = entries[i];
    const tax = taxIncluded(e.amount, e.rate);
    if (e.registered) {
      results[i] = { ...e, tax, ratio: 1, ratioLabel: "100%（インボイス発行事業者）", deductible: tax, nonDeductible: 0, capExceeded: false };
      continue;
    }
    const base = ratioFor(e.date);
    const before = cumulative;
    cumulative += e.amount;
    // 上限超過部分は経過措置の対象外（控除0）。行が上限をまたぐ場合は按分する。
    let eligibleAmount = e.amount;
    let capExceeded = false;
    if (base.ratio > 0 && base.ratio < 1 && cumulative > ANNUAL_CAP_YEN) {
      capExceeded = true;
      capWarning = true;
      eligibleAmount = Math.max(0, ANNUAL_CAP_YEN - before);
    }
    const eligibleTax = e.amount === 0 ? 0 : Math.floor((tax * eligibleAmount) / e.amount);
    const deductible = Math.floor(eligibleTax * base.ratio);
    results[i] = { ...e, tax, ratio: base.ratio, ratioLabel: base.label, deductible, nonDeductible: tax - deductible, capExceeded };
  }
  const sum = (f: (r: LineResult) => number) => results.reduce((s, r) => s + f(r), 0);
  return {
    lines: results,
    totalTax: sum((r) => r.tax),
    totalDeductible: sum((r) => r.deductible),
    totalNonDeductible: sum((r) => r.nonDeductible),
    nonRegisteredTotal: sum((r) => (r.registered ? 0 : r.amount)),
    capWarning,
  };
}

export interface ParseResult {
  entries: Entry[];
  errors: string[];
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 引用符付きフィールド（"110,000" や "" エスケープ）に対応した1行分割。区切りはカンマまたはタブ。 */
export function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === "," || ch === "\t") { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** 2026/1/5 や 2026-1-5 を 2026-01-05 に正規化する。 */
export function normalizeDate(raw: string): string {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(raw.trim());
  return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : raw.trim();
}

/**
 * CSV/TSV貼り付けのパース。列: 取引日, 取引先, 税込金額, 税率(10|8), 発行事業者(Y/N)
 * 先頭行がヘッダ（日付として解釈できない）なら読み飛ばす。
 */
export function parseTable(text: string): ParseResult {
  const entries: Entry[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  lines.forEach((line, idx) => {
    const cols = splitLine(line);
    const n = idx + 1;
    const date = normalizeDate(cols[0] ?? "");
    if (idx === 0 && !isValidDate(date) && !/^\d/.test(cols[0] ?? "")) return; // ヘッダ
    if (!isValidDate(date)) return void errors.push(`${n}行目: 取引日が不正です (${cols[0] ?? ""})`);
    const amount = Number((cols[2] ?? "").replace(/[¥円,\s]/g, ""));
    if (!Number.isInteger(amount) || amount < 0) return void errors.push(`${n}行目: 税込金額が不正です (${cols[2] ?? ""})`);
    const rate = Number((cols[3] ?? "10").replace("%", "") || "10");
    if (rate !== 10 && rate !== 8) return void errors.push(`${n}行目: 税率は10か8を指定してください (${cols[3] ?? ""})`);
    const flag = (cols[4] ?? "N").toUpperCase();
    if (!["Y", "N", "はい", "いいえ"].includes(flag)) return void errors.push(`${n}行目: 発行事業者はY/Nで指定してください (${cols[4] ?? ""})`);
    entries.push({ date, supplier: cols[1] ?? "", amount, rate: rate as TaxRate, registered: flag === "Y" || flag === "はい" });
  });
  return { entries, errors };
}

function csvCell(v: string | number): string {
  let s = String(v);
  // CSVインジェクション対策: 数式として解釈される先頭文字を無効化
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(summary: Summary): string {
  const head = ["取引日", "取引先", "税込金額", "税率", "発行事業者", "消費税額", "控除割合", "控除可能額", "控除不能額"];
  const rows = summary.lines.map((l) =>
    [l.date, l.supplier, l.amount, `${l.rate}%`, l.registered ? "Y" : "N", l.tax, `${Math.round(l.ratio * 100)}%`, l.deductible, l.nonDeductible].map(csvCell).join(","),
  );
  return "﻿" + [head.join(","), ...rows].join("\r\n");
}
