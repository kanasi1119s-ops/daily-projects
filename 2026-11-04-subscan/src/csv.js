// CSV解析・文字コード判定・列推定
export function decodeBuffer(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8);
  } catch {
    return new TextDecoder('shift_jis').decode(u8);
  }
}

export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"' && cur === '') q = true; // 引用符はフィールド先頭のみ有効(5" monitor 等を壊さない)
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const DATE_H = /(日付|利用日|ご利用日|取引日|年月日|date)/i;
const DESC_H = /(利用先|ご利用店|店名|摘要|内容|名称|加盟店|取引内容|description|merchant|payee)/i;
const AMT_STRONG = /(金額|利用額|amount)/i;
const AMT_WEAK = /(出金|支払|debit)/i;
const AMT_NOT = /(区分|方法|回数|日|月|先|条件)/; // 「支払区分」「支払日」等を金額列と誤認しない

export function detectColumns(rows) {
  // ヘッダ行を先頭5行から探す
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const h = rows[r];
    const date = h.findIndex((x) => DATE_H.test(x));
    const desc = h.findIndex((x) => DESC_H.test(x));
    let amt = h.findIndex((x) => AMT_STRONG.test(x) && !/(区分|回数|方法)/.test(x));
    if (amt < 0) amt = h.findIndex((x) => AMT_WEAK.test(x) && !AMT_NOT.test(x));
    if (date >= 0 && desc >= 0 && amt >= 0) return { headerRow: r, date, desc, amt };
  }
  return null;
}
