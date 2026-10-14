// 電帳法リネーマー コアロジック（DOM非依存・純関数）

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;
export const DOC_TYPES = ['請求書', '領収書', '見積書', '納品書', '契約書', 'その他'];

/** ファイル名に使えない文字を除去し、空白を詰める */
export function sanitizePart(s) {
  return String(s ?? '').replace(FORBIDDEN, '').replace(/\s+/g, '').trim();
}

/** 'YYYY-MM-DD' / 'YYYYMMDD' / 'YYYY/M/D' を検証し 'YYYYMMDD' を返す。不正なら null */
export function normalizeDate(input) {
  const m = String(input ?? '').trim().match(/^(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${m[1]}${String(mo).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/** 全角数字・カンマ・円記号を許容して整数金額にする。不正なら null */
export function parseAmount(input) {
  const s = String(input ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，円¥￥\s]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

export function extOf(filename) {
  const i = filename.lastIndexOf('.');
  return i > 0 && i < filename.length - 1 ? filename.slice(i).toLowerCase() : '';
}

/**
 * 1件分の入力から新ファイル名を生成する。
 * 戻り値: { ok, name?, errors[] }
 */
export function buildName({ date, partner, amount, docType, original }) {
  const errors = [];
  const d = normalizeDate(date);
  if (!d) errors.push('日付が不正です（例: 2026-10-14）');
  const p = sanitizePart(partner);
  if (!p) errors.push('取引先を入力してください');
  const a = parseAmount(amount);
  if (a === null) errors.push('金額は整数で入力してください');
  const t = sanitizePart(docType) || 'その他';
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors, name: `${d}_${p}_${a}_${t}${extOf(original ?? '')}` };
}

/** 重複名に _2, _3 … を付与（拡張子の前）。入力順を保つ */
export function dedupeNames(names) {
  const seen = new Map();
  return names.map((n) => {
    if (n == null) return n;
    const key = n.toLowerCase();
    const c = (seen.get(key) ?? 0) + 1;
    seen.set(key, c);
    if (c === 1) return n;
    const e = extOf(n);
    return `${n.slice(0, n.length - e.length)}_${c}${e}`;
  });
}

function csvCell(v) {
  const s = String(v ?? '');
  // CSVインジェクション対策: 式として解釈される先頭文字を無害化
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** 検索要件（日付・金額・取引先）の索引簿CSV。BOM付きUTF-8でExcel対応 */
export function buildCsv(rows) {
  const head = ['新ファイル名', '取引年月日', '取引金額', '取引先', '書類種別', '元ファイル名'];
  const lines = [head, ...rows.map((r) => [r.name, r.date, r.amount, r.partner, r.docType, r.original])];
  return '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

let CRC_TABLE;
export function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** 無圧縮(store)ZIP。files: [{name:string, data:Uint8Array}] */
export function buildZip(files) {
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
    h.setUint16(6, 0x0800, true); // UTF-8 filename
    h.setUint16(8, 0, true);
    h.setUint16(10, 0, true);
    h.setUint16(12, 0x21, true); // 1980-01-01
    h.setUint32(14, crc, true);
    h.setUint32(18, f.data.length, true);
    h.setUint32(22, f.data.length, true);
    h.setUint16(26, nameBytes.length, true);
    h.setUint16(28, 0, true);
    central.push({ nameBytes, crc, size: f.data.length, offset });
    push(new Uint8Array(h.buffer));
    push(nameBytes);
    push(f.data);
  }
  const cdStart = offset;
  for (const c of central) {
    const h = new DataView(new ArrayBuffer(46));
    h.setUint32(0, 0x02014b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 20, true);
    h.setUint16(8, 0x0800, true);
    h.setUint16(14, 0x21, true);
    h.setUint32(16, c.crc, true);
    h.setUint32(20, c.size, true);
    h.setUint32(24, c.size, true);
    h.setUint16(28, c.nameBytes.length, true);
    h.setUint32(42, c.offset, true);
    push(new Uint8Array(h.buffer));
    push(c.nameBytes);
  }
  const cdSize = offset - cdStart;
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, central.length, true);
  e.setUint16(10, central.length, true);
  e.setUint32(12, cdSize, true);
  e.setUint32(16, cdStart, true);
  push(new Uint8Array(e.buffer));
  const out = new Uint8Array(offset);
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}
