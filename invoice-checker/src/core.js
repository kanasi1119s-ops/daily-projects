// インボイス(適格請求書)チェッカー: コアロジック(DOM非依存)

/** 登録番号の形式とチェックデジットを検証する */
export function validateRegistrationNumber(raw) {
  const s = String(raw ?? "").normalize("NFKC").trim();
  if (!s) return { ok: false, reason: "未入力です" };
  if (!/^T\d{13}$/.test(s)) return { ok: false, reason: "「T」+数字13桁の形式ではありません" };
  const digits = s.slice(1);
  const check = Number(digits[0]);
  let sum = 0;
  // 右端を n=1 とし、奇数桁×1・偶数桁×2 の合計(下12桁)
  for (let n = 1; n <= 12; n++) {
    const d = Number(digits[13 - n]);
    sum += d * (n % 2 === 1 ? 1 : 2);
  }
  const expected = 9 - (sum % 9);
  if (expected !== check) return { ok: false, reason: "チェックデジットが一致しません(番号の入力誤りの可能性)" };
  return { ok: true, value: s };
}

export const ROUNDINGS = { floor: Math.floor, round: Math.round, ceil: Math.ceil };

/** 小数誤差を避けるため整数演算で税額を計算: amount * rate% */
export function calcTax(amount, ratePercent, rounding = "floor") {
  const fn = ROUNDINGS[rounding] ?? Math.floor;
  const scaled = Math.round(amount * ratePercent * 1000); // 0.001単位の誤差吸収
  return fn(scaled / 100000);
}

/** 明細から税率ごとの集計を行う。税率ごとに1回だけ端数処理する */
export function summarize(items, { taxIncluded = false, rounding = "floor" } = {}) {
  const groups = new Map();
  for (const it of items) {
    const rate = Number(it.rate);
    const qty = Number(it.qty);
    const price = Number(it.unitPrice);
    if (![rate, qty, price].every(Number.isFinite)) continue;
    const line = Math.round(qty * price * 1000) / 1000;
    groups.set(rate, (groups.get(rate) ?? 0) + line);
  }
  const rows = [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, sum]) => {
      const total = Math.round(sum * 1000) / 1000;
      let exTax, tax, inTax;
      if (taxIncluded) {
        inTax = total;
        tax = calcTax(total * rate / (100 + rate), 100, rounding);
        exTax = inTax - tax;
      } else {
        exTax = total;
        tax = calcTax(total, rate, rounding);
        inTax = exTax + tax;
      }
      return { rate, exTax, tax, inTax };
    });
  const grand = rows.reduce((a, r) => ({
    exTax: a.exTax + r.exTax, tax: a.tax + r.tax, inTax: a.inTax + r.inTax,
  }), { exTax: 0, tax: 0, inTax: 0 });
  return { rows, grand };
}

/**
 * 適格請求書の記載事項チェック。
 * invoice: { kind: "standard"|"simplified", issuerName, regNo, date, recipientName,
 *            items:[{desc, qty, unitPrice, rate, reduced}], statedTax:{[rate]:number|null},
 *            taxIncluded, rounding }
 */
export function checkInvoice(invoice) {
  const results = [];
  const add = (id, label, status, message) => results.push({ id, label, status, message });
  const simplified = invoice.kind === "simplified";

  add("issuer", "発行者の氏名または名称", invoice.issuerName?.trim() ? "ok" : "ng",
    invoice.issuerName?.trim() ? "記載あり" : "未記載です");

  const reg = validateRegistrationNumber(invoice.regNo);
  add("regno", "登録番号(T+13桁)", reg.ok ? "ok" : "ng", reg.ok ? "形式・チェックデジットOK(※国税庁公表サイトでの存在確認は別途必要)" : reg.reason);

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(invoice.date ?? "") && !Number.isNaN(Date.parse(invoice.date));
  add("date", "取引年月日", dateOk ? "ok" : "ng", dateOk ? "記載あり" : "未記載または不正な日付です");

  const items = (invoice.items ?? []).filter(i => i.desc?.trim());
  const badNum = items.filter(i => !Number.isFinite(i.qty) || !Number.isFinite(i.unitPrice) || i.qty == null || i.unitPrice == null);
  add("content", "取引内容", items.length ? "ok" : "ng", items.length ? `${items.length}件の明細` : "明細がありません");

  if (badNum.length) add("numbers", "明細の数量・単価", "ng", `${badNum.length}件の明細で数量または単価が未入力・不正です`);

  const hasReduced = items.some(i => Number(i.rate) === 8);
  if (hasReduced) {
    const missing = items.filter(i => Number(i.rate) === 8 && !i.reduced);
    add("reduced", "軽減税率対象の明示(※等)", missing.length ? "ng" : "ok",
      missing.length ? `軽減税率(8%)の明細${missing.length}件に「※」等の対象明示がありません` : "8%明細に対象明示あり");
  }

  const summary = summarize(items, { taxIncluded: invoice.taxIncluded, rounding: invoice.rounding });
  add("rates", "税率ごとに区分した対価の額", summary.rows.length ? "ok" : "ng",
    summary.rows.length ? summary.rows.map(r => `${r.rate}%: 税${invoice.taxIncluded ? "込" : "抜"}${(invoice.taxIncluded ? r.inTax : r.exTax).toLocaleString("ja-JP")}円`).join(" / ") : "集計できる明細がありません");

  // 税額チェック
  const stated = invoice.statedTax ?? {};
  let taxStatus = "ok", taxMsg = [];
  for (const r of summary.rows) {
    const s = stated[r.rate];
    if (s == null || s === "") {
      if (!simplified) { taxStatus = "ng"; taxMsg.push(`${r.rate}%の消費税額が未記載`); }
      continue;
    }
    if (Number(s) !== r.tax) {
      taxStatus = "ng";
      taxMsg.push(`${r.rate}%の消費税額が不一致(記載${Number(s).toLocaleString("ja-JP")}円 / 計算${r.tax.toLocaleString("ja-JP")}円)`);
    }
  }
  if (simplified && taxStatus === "ok" && Object.keys(stated).length === 0) {
    add("tax", "適用税率または消費税額(簡易請求書はいずれか)", "ok", "税率ごとに区分されているため要件を満たします(税額の記載は任意)");
  } else {
    add("tax", "税率ごとの消費税額と端数処理", taxStatus, taxMsg.length ? taxMsg.join("、") : "税率ごとに1回の端数処理で一致");
  }

  if (!simplified) {
    add("recipient", "書類の交付を受ける事業者の氏名または名称", invoice.recipientName?.trim() ? "ok" : "ng",
      invoice.recipientName?.trim() ? "記載あり" : "未記載です");
  }

  const ng = results.filter(r => r.status === "ng").length;
  const warn = results.filter(r => r.status === "warn").length;
  return { results, summary, ng, warn, pass: ng === 0 };
}
