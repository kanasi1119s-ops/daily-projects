// 電帳法ファイル名リネーマーの純粋ロジック(DOM非依存)

const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i; // Windows予約名
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;

export function toHalfWidth(s) {
  return String(s ?? '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

/** YYYY-MM-DD / YYYY/MM/DD / YYYYMMDD / 全角 を YYYYMMDD に正規化。不正なら null */
export function normalizeDate(input) {
  const s = toHalfWidth(input).trim();
  const m = s.match(/^(\d{4})[-/.]?(\d{1,2})[-/.]?(\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[1]}${String(mo).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/** 金額を整数文字列へ。カンマ・円・¥ を許容。不正なら null */
export function normalizeAmount(input) {
  const s = toHalfWidth(input).replace(/[,\s¥円]/g, '');
  if (!/^\d+$/.test(s)) return null;
  return String(Number(s));
}

export function sanitizePart(input, maxLen = 40) {
  return toHalfWidth(input)
    .replace(ILLEGAL, '')
    .replace(/\s+/g, '')
    .replace(/^\.+/, '')
    .slice(0, maxLen)
    .replace(/\.+$/, '')
    .replace(RESERVED, (m) => m + "_");
}

export function splitExt(filename) {
  const i = filename.lastIndexOf('.');
  if (i <= 0 || i === filename.length - 1) return { base: filename, ext: '' };
  return { base: filename.slice(0, i), ext: filename.slice(i).toLowerCase() };
}

/** 1件分の入力を検証し、新ファイル名を返す */
export function buildFileName({ date, vendor, amount, originalName }) {
  const errors = [];
  const d = normalizeDate(date);
  if (!d) errors.push('取引年月日が不正です');
  const v = sanitizePart(vendor);
  if (!v) errors.push('取引先が空です');
  const a = normalizeAmount(amount);
  if (a === null) errors.push('金額が不正です(半角/全角の数字のみ)');
  const { ext } = splitExt(originalName || '');
  if (errors.length) return { ok: false, errors };
  return { ok: true, name: `${d}_${v}_${a}${ext}`, date: d, vendor: v, amount: a };
}

/** 重複名に _2, _3 ... を拡張子の前へ付与 */
export function dedupeNames(names) {
  const seen = new Map();
  return names.map((n) => {
    const key = n.toLowerCase();
    const c = (seen.get(key) ?? 0) + 1;
    seen.set(key, c);
    if (c === 1) return n;
    const { base, ext } = splitExt(n);
    return `${base}_${c}${ext}`;
  });
}

function csvCell(v) {
  const s = String(v ?? '');
  // CSV/数式インジェクション対策: 先頭が = + - @ の場合は ' を付与
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** 検索簿CSV(Excel向けBOM付き) */
export function toCsv(rows) {
  const head = ['新ファイル名', '元ファイル名', '取引年月日', '取引先', '取引金額'];
  const lines = [head, ...rows.map((r) => [r.name, r.originalName, r.date, r.vendor, r.amount])];
  return '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ---- 最小ZIPライタ(無圧縮/STORE) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** files: [{name: string, data: Uint8Array}] -> Uint8Array(zip) */
export function makeZip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const push = (u8) => { chunks.push(u8); offset += u8.length; };
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true); // UTF-8 ファイル名
    h.setUint16(8, 0, true);
    h.setUint16(10, 0, true);
    h.setUint16(12, 0x21, true); // 1980-01-01
    h.setUint32(14, crc, true);
    h.setUint32(18, f.data.length, true);
    h.setUint32(22, f.data.length, true);
    h.setUint16(26, nameBytes.length, true);
    h.setUint16(28, 0, true);
    const localOffset = offset;
    push(new Uint8Array(h.buffer)); push(nameBytes); push(f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true);
    c.setUint16(28, nameBytes.length, true);
    c.setUint32(42, localOffset, true);
    central.push(new Uint8Array(c.buffer), nameBytes);
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const u of central) { push(u); cdSize += u.length; }
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, cdStart, true);
  push(new Uint8Array(e.buffer));
  const out = new Uint8Array(offset);
  let p = 0;
  for (const u of chunks) { out.set(u, p); p += u.length; }
  return out;
}
