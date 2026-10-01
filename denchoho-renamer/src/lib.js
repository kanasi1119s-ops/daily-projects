// 純粋関数のみ。DOM非依存でテスト可能。

const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f]/g;

export function toHalfWidth(s) {
  return String(s ?? '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

// 取引年月日を YYYYMMDD に正規化。不正なら null。
export function normalizeDate(input) {
  const s = toHalfWidth(input).trim();
  let y, m, d;
  let match = s.match(/^(\d{4})[-/.年]?(\d{1,2})[-/.月]?(\d{1,2})日?$/);
  if (match) [, y, m, d] = match;
  else return null;
  y = +y; m = +m; d = +d;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

// 金額を整数文字列に正規化(カンマ・円記号除去)。不正なら null。
export function normalizeAmount(input) {
  const s = toHalfWidth(input).replace(/[,\s円¥￥]/g, '');
  if (!/^\d+$/.test(s)) return null;
  return String(Number(s));
}

export function sanitizePart(input, max = 40) {
  const s = toHalfWidth(input)
    .replace(ILLEGAL, '')
    .replace(/\s+/g, '')
    .replace(/^\.+/, '')
    .replace(/_+/g, '-');
  const cut = Array.from(s).slice(0, max).join('').replace(/\.+$/, '');
  // Windows予約名(CON, NUL, COM1 等)を回避
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(cut) ? `${cut}-` : cut;
}

export function splitExt(name) {
  const i = name.lastIndexOf('.');
  if (i <= 0 || i === name.length - 1) return { base: name, ext: '' };
  return { base: name.slice(0, i), ext: name.slice(i).toLowerCase().replace(ILLEGAL, '').replace(/\s+/g, '').slice(0, 11) };
}

// 1件分のメタ情報から { ok, filename?, errors[] } を返す。
export function buildFilename({ originalName, date, partner, amount, kind }) {
  const errors = [];
  const d = normalizeDate(date);
  if (!d) errors.push('取引年月日が不正です(例: 2026-04-01)');
  const a = normalizeAmount(amount);
  if (a === null) errors.push('金額は数字で入力してください');
  const p = sanitizePart(partner);
  if (!p) errors.push('取引先を入力してください');
  if (errors.length) return { ok: false, errors };
  const k = sanitizePart(kind, 10);
  const { ext } = splitExt(originalName);
  const parts = [d, p, a];
  if (k) parts.push(k);
  return { ok: true, filename: parts.join('_') + ext, errors, meta: { date: d, partner: p, amount: a, kind: k } };
}

// 重複したファイル名に -2, -3... を付与。大文字小文字は区別しない(Windows/macOS対策)。
export function dedupe(names) {
  const seen = new Map();
  return names.map((n) => {
    const { base, ext } = splitExt(n);
    let candidate = n;
    let i = seen.get(n.toLowerCase()) ?? 0;
    if (i === 0) { seen.set(n.toLowerCase(), 1); return n; }
    do { i += 1; candidate = `${base}-${i}${ext}`; } while (seen.has(candidate.toLowerCase()));
    seen.set(n.toLowerCase(), i);
    seen.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}

function csvCell(v) {
  let s = String(v ?? '');
  // CSVインジェクション対策: 式として解釈される先頭文字を無効化
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  const header = ['新ファイル名', '取引年月日', '取引先', '金額', '書類種別', '元ファイル名'];
  const lines = [header, ...rows.map((r) => [r.filename, r.date, r.partner, r.amount, r.kind, r.originalName])];
  return '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

// ---- 最小ZIP(無圧縮・UTF-8ファイル名) ----
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

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

// entries: [{ name: string, data: Uint8Array }]
export function makeZip(entries, now = new Date()) {
  const enc = new TextEncoder();
  const { time, day } = dosDateTime(now);
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, day, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}
