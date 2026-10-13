// 入力文字列（全角数字・カンマ・円記号可）を整数に変換。空・不正は NaN
export function parseYen(text) {
  const half = text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const cleaned = half.replace(/[,，円\s]/g, '');
  return /^\d+$/.test(cleaned) ? Number(cleaned) : NaN;
}

