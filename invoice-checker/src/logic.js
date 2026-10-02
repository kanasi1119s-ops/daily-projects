// 適格請求書の計算・検証ロジック（DOM非依存）

export const RATES = [10, 8];

/** 登録番号 T+13桁の形式チェック */
export function checkRegistrationFormat(v) {
  return /^T\d{13}$/.test(String(v ?? "").trim());
}

/** 法人番号(13桁)のチェックデジット検証。法人のみ有効、個人事業者は判定不可 */
export function checkCorporateNumberDigit(num13) {
  if (!/^\d{13}$/.test(num13)) return false;
  const check = Number(num13[0]);
  const body = num13.slice(1); // 12桁
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = 12 - i; // 下位から数えた位置
    sum += Number(body[i]) * (n % 2 === 1 ? 1 : 2);
  }
  return check === 9 - (sum % 9);
}

const ROUNDERS = {
  floor: Math.floor,
  round: Math.round,
  ceil: Math.ceil,
};

/**
 * 税率ごとに合計した上で1回だけ端数処理する（適格請求書の要件）
 * items: [{name, qty, unitPrice, rate}] 税抜価格
 */
export function calcInvoice(items, rounding = "floor") {
  const fn = ROUNDERS[rounding] ?? ROUNDERS.floor;
  const byRate = {};
  for (const r of RATES) byRate[r] = { subtotal: 0, tax: 0 };
  for (const it of items) {
    const rate = Number(it.rate);
    if (!byRate[rate]) continue;
    const qty = Number(it.qty);
    const price = Number(it.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) continue;
    byRate[rate].subtotal += Math.round(qty * price * 100) / 100;
  }
  let total = 0;
  for (const r of RATES) {
    byRate[r].subtotal = Math.round(byRate[r].subtotal);
    byRate[r].tax = fn((byRate[r].subtotal * r) / 100);
    total += byRate[r].subtotal + byRate[r].tax;
  }
  return { byRate, total };
}

/** 適格請求書の必須記載事項チェック。{level:'error'|'warn', msg}[] を返す */
export function validateInvoice(inv) {
  const out = [];
  const err = (msg) => out.push({ level: "error", msg });
  const warn = (msg) => out.push({ level: "warn", msg });
  if (!inv.issuerName?.trim()) err("発行者の氏名または名称が未入力です");
  if (!inv.registrationNumber?.trim()) err("登録番号（T+13桁）が未入力です");
  else if (!checkRegistrationFormat(inv.registrationNumber))
    err("登録番号は「T」+数字13桁の形式で入力してください");
  else if (
    !checkCorporateNumberDigit(inv.registrationNumber.trim().slice(1))
  )
    warn(
      "法人番号のチェックデジットが一致しません（個人事業者の場合は問題ない場合があります。国税庁の公表サイトで確認してください）"
    );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.date ?? "")) err("取引年月日が未入力です");
  if (!inv.recipientName?.trim()) warn("宛名が未入力です（不特定多数向けの場合は省略可）");
  const valid = (inv.items ?? []).filter((i) => i.name?.trim());
  if (valid.length === 0) err("取引内容（品目）が1件もありません");
  for (const [idx, i] of valid.entries()) {
    if (!(Number(i.qty) > 0)) err(`品目${idx + 1}: 数量が不正です`);
    if (!(Number(i.unitPrice) >= 0)) err(`品目${idx + 1}: 単価が不正です`);
    if (![8, 10].includes(Number(i.rate))) err(`品目${idx + 1}: 税率は8%か10%を選択してください`);
  }
  if (valid.some((i) => Number(i.rate) === 8))
    warn("軽減税率(8%)の品目がある場合、「※」等で軽減税率対象であることの明示が必要です（本ツールは※を自動付与します）");
  return out;
}
