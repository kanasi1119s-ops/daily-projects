export interface Entry {
  originalName: string;
  date: string;
  docType: string;
  vendor: string;
  amount: string;
}

export const DEFAULT_TEMPLATE = '{date}_{type}_{vendor}_{amount}';
const MAX_BASE_LEN = 120;

/** 全角英数記号を半角へ */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

/** ファイル名に使えない文字を除去・置換 */
export function sanitize(s: string): string {
  return s
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');
}

/** 日付を YYYYMMDD へ。不正なら null。令和/平成表記にも対応 */
export function normalizeDate(input: string): string | null {
  const s = toHalfWidth(input).trim();
  let y: number, m: number, d: number;
  let mt = s.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (mt) {
    [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  } else if ((mt = s.match(/^(\d{4})(\d{2})(\d{2})$/))) {
    [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  } else if ((mt = s.match(/^(令和|平成|R|H)(\d{1,2}|元)[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/))) {
    const n = mt[2] === '元' ? 1 : +mt[2];
    const base = mt[1] === '令和' || mt[1] === 'R' ? 2018 : 1988;
    [y, m, d] = [base + n, +mt[3], +mt[4]];
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/** 金額を整数文字列へ(カンマ・円・¥除去)。不正なら null */
export function normalizeAmount(input: string): string | null {
  const s = toHalfWidth(input).replace(/[,\s¥円]/g, '');
  if (!/^\d{1,13}$/.test(s)) return null;
  return String(Number(s));
}

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(i).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
}

export interface BuildResult {
  name: string | null;
  errors: string[];
}

export function buildFileName(e: Entry, template = DEFAULT_TEMPLATE): BuildResult {
  const errors: string[] = [];
  const date = normalizeDate(e.date);
  const amount = normalizeAmount(e.amount);
  const vendor = sanitize(toHalfWidth(e.vendor).normalize('NFC'));
  const type = sanitize(toHalfWidth(e.docType).normalize('NFC'));
  if (!date) errors.push('日付が不正です');
  if (!amount) errors.push('金額が不正です(整数のみ)');
  if (!vendor) errors.push('取引先が未入力です');
  if (errors.length) return { name: null, errors };
  const build = (v: string) =>
    template
      .replace('{date}', () => date!)
      .replace('{type}', () => type)
      .replace('{vendor}', () => v)
      .replace('{amount}', () => `${amount}円`)
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  // 長すぎる場合は取引先名だけを切り詰め、日付・金額が欠けないようにする
  let chars = Array.from(vendor);
  let base = build(vendor);
  while (Array.from(base).length > MAX_BASE_LEN && chars.length > 1) {
    const over = Array.from(base).length - MAX_BASE_LEN;
    chars = chars.slice(0, Math.max(1, chars.length - over));
    base = build(chars.join('').trim());
  }
  return { name: base + extOf(e.originalName), errors };
}

/** 同名衝突を _2, _3 で回避 */
export function dedupe(names: string[]): string[] {
  const seen = new Map<string, number>();
  const used = new Set(names.map((n) => n.toLowerCase()));
  return names.map((n) => {
    const key = n.toLowerCase();
    const c = (seen.get(key) ?? 0) + 1;
    seen.set(key, c);
    if (c === 1) return n;
    const ext = extOf(n);
    const base = ext ? n.slice(0, -ext.length) : n;
    let k = c;
    let cand = `${base}_${k}${ext}`;
    while (used.has(cand.toLowerCase())) cand = `${base}_${++k}${ext}`;
    used.add(cand.toLowerCase());
    return cand;
  });
}
