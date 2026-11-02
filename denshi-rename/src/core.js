// 電子取引データ向け ファイル名生成・台帳CSV・ZIP生成の純粋関数群（DOM非依存）

const ERA = { 令和: 2018, R: 2018, 平成: 1988, H: 1988 };

/** 全角英数記号を半角へ */
export function toHalfWidth(s) {
  return String(s ?? '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

/** 日付文字列を YYYYMMDD に正規化。不正なら null */
export function normalizeDate(input) {
  const s = toHalfWidth(input).trim();
  if (!s) return null;
  let y, m, d, match;
  if ((match = s.match(/^(令和|平成|[RH])\s*(\d{1,2}|元)\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?$/i))) {
    const base = ERA[match[1]] ?? ERA[match[1].toUpperCase()];
    const n = match[2] === '元' ? 1 : Number(match[2]);
    y = base + n; m = Number(match[3]); d = Number(match[4]);
  } else if ((match = s.match(/^(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?$/))) {
    y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
  } else if ((match = s.match(/^(\d{4})(\d{2})(\d{2})$/))) {
    y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1989 || y > 2100) return null;
  return `${String(y).padStart(4, '0')}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

/** 金額文字列を整数(円)に。不正なら null。小数・負数は不可 */
export function normalizeAmount(input) {
  const s = toHalfWidth(input).replace(/[,\s¥￥円]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
// 不可視・双方向制御文字（ファイル名偽装対策）
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** ファイル名に使えない文字を除去・置換 */
export function sanitizeName(input, maxLen = 60) {
  let s = toHalfWidth(input).replace(INVISIBLE, '').replace(FORBIDDEN, '_').replace(/\s+/g, '_').replace(/^[._]+|[._]+$/g, '');
  s = [...s].slice(0, maxLen).join('');
  if (RESERVED.test(s)) s = `_${s}`;
  return s;
}

export function getExt(fileName) {
  const i = fileName.lastIndexOf('.');
  return i > 0 && i < fileName.length - 1 ? fileName.slice(i).toLowerCase() : '';
}

/** 行データの検証。errors配列を返す（空なら有効） */
export function validateRow(row) {
  const errors = [];
  if (!normalizeDate(row.date)) errors.push('日付が不正です（例: 2026-11-02 / 令和8年11月2日）');
  if (normalizeAmount(row.amount) === null) errors.push('金額は0以上の整数で入力してください');
  if (!sanitizeName(row.partner)) errors.push('取引先を入力してください');
  return errors;
}

/** 「日付_取引先_金額.拡張子」を生成。無効なら null */
export function buildFileName(row, originalName) {
  if (validateRow(row).length) return null;
  const date = normalizeDate(row.date);
  const amount = normalizeAmount(row.amount);
  const partner = sanitizeName(row.partner);
  return `${date}_${partner}_${amount}${getExt(originalName)}`;
}

/** 重複名に _2, _3 を付与（拡張子の前）。入力順を保持 */
export function dedupeNames(names) {
  const used = new Set(names.filter((n) => n !== null).map((n) => n.toLowerCase()));
  const taken = new Set();
  return names.map((n) => {
    if (n === null) return null;
    if (!taken.has(n.toLowerCase())) { taken.add(n.toLowerCase()); return n; }
    const ext = getExt(n);
    const stem = n.slice(0, n.length - ext.length);
    for (let i = 2; ; i++) {
      const cand = `${stem}_${i}${ext}`;
      if (!taken.has(cand.toLowerCase()) && !used.has(cand.toLowerCase())) { taken.add(cand.toLowerCase()); return cand; }
    }
  });
}

function csvCell(v) {
  let s = String(v ?? '');
  // CSVインジェクション対策: 式として解釈されうる先頭文字を無害化
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 検索台帳CSV（Excel向けBOM付きUTF-8）。rows: {date,amount,partner,docType,note,newName,originalName} */
export function buildLedgerCsv(rows) {
  const head = ['取引年月日', '取引金額', '取引先', '書類種別', '備考', '保存ファイル名', '元ファイル名'];
  const lines = [head.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push([
      normalizeDate(r.date), normalizeAmount(r.amount), r.partner, r.docType, r.note, r.newName, r.originalName,
    ].map(csvCell).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---- 無圧縮ZIP (STORE) ----
let crcTable;
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** files: [{name:string, data:Uint8Array}] -> Uint8Array(ZIP)。名前はUTF-8 */
export function buildZip(files, now = new Date()) {
  const enc = new TextEncoder();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((Math.max(now.getFullYear(), 1980) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, f.data.length, true); lh.setUint32(22, f.data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, f.data.length, true);
    ch.setUint32(24, f.data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
}
