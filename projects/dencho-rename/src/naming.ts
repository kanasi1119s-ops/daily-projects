/** 電子取引データ向けファイル名生成ロジック（純粋関数・外部通信なし） */

export interface Entry {
  /** 元のファイル名 */
  original: string;
  /** 取引年月日 YYYY-MM-DD */
  date: string;
  /** 取引先名 */
  partner: string;
  /** 取引金額（円・整数文字列可） */
  amount: string;
  /** 任意メモ（書類種別など） */
  note?: string;
}

export interface Options {
  /** 区切り文字 */
  separator: '_' | '-';
  /** 日付をハイフン無し(20261109)にするか */
  compactDate: boolean;
  /** 書類種別などメモをファイル名に含めるか */
  includeNote: boolean;
}

export const defaultOptions: Options = { separator: '_', compactDate: true, includeNote: false };

// Windows/macOS/ZIPで問題になる文字
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;
const MAX_PARTNER = 40;

export function sanitize(s: string): string {
  return s.normalize('NFKC').replace(FORBIDDEN, '').replace(/\s+/g, '').replace(/^\.+/, '');
}

export function parseAmount(raw: string): number | null {
  const t = raw.normalize('NFKC').replace(/[,\s円¥￥]/g, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

export function isValidDate(d: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, da));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === da;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(i).toLowerCase() : '';
}

export function validate(e: Entry): string[] {
  const errs: string[] = [];
  if (!isValidDate(e.date)) errs.push('日付が不正です');
  if (!sanitize(e.partner)) errs.push('取引先が未入力です');
  if (parseAmount(e.amount) === null) errs.push('金額は0以上の整数で入力してください');
  return errs;
}

/** 1件分のファイル名（拡張子込み）。不正な場合は null */
export function buildName(e: Entry, o: Options = defaultOptions): string | null {
  if (validate(e).length) return null;
  const amount = parseAmount(e.amount)!;
  const date = o.compactDate ? e.date.replaceAll('-', '') : e.date;
  const partner = Array.from(sanitize(e.partner)).slice(0, MAX_PARTNER).join('');
  const parts = [date, partner, String(amount)];
  if (o.includeNote && e.note) {
    const n = sanitize(e.note);
    if (n) parts.push(n);
  }
  return parts.join(o.separator) + extOf(e.original);
}

/** 全件の名前を生成し、重複には連番(_2, _3...)を付与。不正行は null */
export function buildAll(entries: Entry[], o: Options = defaultOptions): (string | null)[] {
  const base = entries.map((e) => buildName(e, o));
  const used = new Set(base.filter((b): b is string => b !== null).map((b) => b.toLowerCase()));
  const taken = new Set<string>();
  return base.map((b) => {
    if (b === null) return null;
    if (!taken.has(b.toLowerCase())) { taken.add(b.toLowerCase()); return b; }
    const ext = extOf(b);
    const stem = b.slice(0, b.length - ext.length);
    for (let n = 2; ; n++) {
      const c = `${stem}${o.separator}${n}${ext}`;
      if (!taken.has(c.toLowerCase()) && !used.has(c.toLowerCase())) { taken.add(c.toLowerCase()); return c; }
    }
  });
}

function csvCell(s: string): string {
  const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s; // CSVインジェクション対策
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
}

/** 索引簿CSV（元ファイル名→新ファイル名と検索項目） */
export function buildIndexCsv(entries: Entry[], names: (string | null)[]): string {
  const head = ['新ファイル名', '元ファイル名', '取引年月日', '取引先', '取引金額', 'メモ'];
  const rows = entries.flatMap((e, i) => {
    const n = names[i];
    if (n === null) return [];
    return [[n, e.original, e.date, sanitize(e.partner), String(parseAmount(e.amount)), e.note ?? '']];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** ファイル名から推測（YYYYMMDD / YYYY-MM-DD / YYYY年M月D日 を日付候補に） */
export function guessFromFilename(name: string): Partial<Entry> {
  const base = name.replace(/\.[^.]+$/, '').normalize('NFKC');
  let m = /(20\d{2})[-_/.]?(\d{2})[-_/.]?(\d{2})/.exec(base);
  let date: string | undefined;
  if (m) date = `${m[1]}-${m[2]}-${m[3]}`;
  else if ((m = /(20\d{2})年(\d{1,2})月(\d{1,2})日/.exec(base)))
    date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return date && isValidDate(date) ? { date } : {};
}
