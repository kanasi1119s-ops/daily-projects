// 命名・正規化ロジック(DOM非依存。node:test で検証する)
export const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;

// base: 元年の西暦-1 / from,to: その元号として有効な日付範囲(YYYYMMDD)
const ERA_DEF = {
  令和: { base: 2018, from: 20190501, to: 99991231 },
  平成: { base: 1988, from: 19890108, to: 20190430 },
  昭和: { base: 1925, from: 19261225, to: 19890107 },
};
const ERA_ALIAS = { R: "令和", H: "平成", S: "昭和" };

const toHalf = (s) =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／－ー−‐]/g, (c) => (c === "／" ? "/" : "-"));

function validYMD(y, m, d) {
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1)) return false;
  const last = new Date(y, m, 0).getDate();
  return d <= last;
}

/** 日付文字列を YYYYMMDD に正規化。不正なら null */
export function normalizeDate(input) {
  if (typeof input !== "string") return null;
  const s = toHalf(input.trim()).replace(/\s+/g, "");
  let y, m, d, r;
  if ((r = s.match(/^(令和|平成|昭和|[RHS])\.?(\d{1,2}|元)[年./-](\d{1,2})[月./-](\d{1,2})日?$/i))) {
    const era = ERA_DEF[ERA_ALIAS[r[1].toUpperCase()] ?? r[1]];
    const ey = r[2] === "元" ? 1 : Number(r[2]);
    if (ey < 1) return null;
    y = era.base + ey;
    m = Number(r[3]); d = Number(r[4]);
    if (!validYMD(y, m, d)) return null;
    const ymd = y * 10000 + m * 100 + d;
    if (ymd < era.from || ymd > era.to) return null;
  } else if ((r = s.match(/^(\d{4})[年./-](\d{1,2})[月./-](\d{1,2})日?$/))) {
    y = Number(r[1]); m = Number(r[2]); d = Number(r[3]);
  } else if ((r = s.match(/^(\d{4})(\d{2})(\d{2})$/))) {
    y = Number(r[1]); m = Number(r[2]); d = Number(r[3]);
  } else return null;
  if (!validYMD(y, m, d)) return null;
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

/** 金額を整数文字列に正規化(円・カンマ・¥・全角対応)。不正なら null */
export function normalizeAmount(input) {
  if (typeof input !== "string") return null;
  const s = toHalf(input.trim()).replace(/[¥￥,，円\s]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n)) return null;
  return String(n);
}

/** ファイル名に使えない文字の除去・空白整理・長さ制限 */
export function sanitizePart(s, max = 40) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(FORBIDDEN, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, max);
}

export const DOC_TYPES = ["領収書", "請求書", "見積書", "納品書", "契約書", "注文書", "その他"];
export const ORDERS = {
  "date-vendor-amount": ["date", "vendor", "amount", "type"],
  "date-amount-vendor": ["date", "amount", "vendor", "type"],
  "vendor-date-amount": ["vendor", "date", "amount", "type"],
};

export function splitExt(filename) {
  const i = filename.lastIndexOf(".");
  return i > 0 && i < filename.length - 1 ? [filename.slice(0, i), filename.slice(i)] : [filename, ""];
}

/**
 * 1ファイル分の新ファイル名を作る。
 * 戻り値: { ok, name, errors[] }
 */
export function buildFileName({ original, date, vendor, amount, type, order = "date-vendor-amount" }) {
  const errors = [];
  const d = normalizeDate(date ?? "");
  const a = normalizeAmount(amount ?? "");
  const v = sanitizePart(vendor);
  if (!d) errors.push("取引年月日が不正です");
  if (a === null) errors.push("取引金額が不正です(半角数字・円・カンマのみ)");
  if (!v) errors.push("取引先が空です");
  const seq = ORDERS[order];
  if (!seq) errors.push("不明な並び順です");
  if (errors.length) return { ok: false, name: "", errors };
  const parts = { date: d, vendor: v, amount: a, type: sanitizePart(type, 10) };
  const [, ext] = splitExt(original ?? "");
  const name = seq.map((k) => parts[k]).filter(Boolean).join("_") + ext.toLowerCase();
  return { ok: true, name, errors: [] };
}

/** 重複名に _2, _3 … を付与(拡張子の前)。入力順を保持 */
export function dedupe(names) {
  const seen = new Map();
  return names.map((n) => {
    if (!n) return n;
    const key = n.toLowerCase();
    const c = (seen.get(key) ?? 0) + 1;
    seen.set(key, c);
    if (c === 1) return n;
    const [base, ext] = splitExt(n);
    return `${base}_${c}${ext}`;
  });
}

/** CSVセル(式インジェクション対策込み) */
export function csvCell(v) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 索引CSV(BOM付きUTF-8でExcelでも文字化けしにくくする) */
export function toCsv(rows) {
  const head = ["新ファイル名", "元ファイル名", "取引年月日", "取引先", "取引金額", "書類種別"];
  const lines = [head, ...rows.map((r) => [r.name, r.original, r.date, r.vendor, r.amount, r.type])];
  return "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
