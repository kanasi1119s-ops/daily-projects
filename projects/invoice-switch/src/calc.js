import { RULES } from './rules.js';

const MAX = 10_000_000_000; // 入力上限(100億円)。それ以上は試算対象外として丸める
const num = (v) => (Number.isFinite(v) ? Math.min(v, MAX) : 0);

/**
 * @param {object} i
 * @param {number} i.sales 年間課税売上(税抜,円)
 * @param {number} i.purchases 年間課税仕入(税抜,円)
 * @param {number} i.year 対象年(西暦)
 * @param {number} i.category 簡易課税の事業区分 1-6
 * @param {number} i.baseSales 基準期間(2年前)の課税売上(税抜,円)
 * @param {number} i.invoiceShare 売上のうちインボイスを求める取引先の割合 0-100
 * @param {number} i.discountPct 免税のままの場合に想定する値引き/取引喪失率(%) その取引先分に対して
 * @param {boolean} i.firstTime 登録により初めて課税事業者になる個人か
 */
export function compare(i) {
  const sales = Math.max(0, num(i.sales));
  const purchases = Math.max(0, num(i.purchases));
  const baseSales = Math.max(0, num(i.baseSales));
  const share = Math.min(100, Math.max(0, num(i.invoiceShare))) / 100;
  const disc = Math.min(100, Math.max(0, num(i.discountPct))) / 100;
  const cat = RULES.deemed[i.category] ? i.category : 5;
  const outTax = Math.floor(sales * RULES.taxRate);
  const inTax = Math.floor(purchases * RULES.taxRate);
  const results = [];

  // 免税のまま: 納税0、取引先影響は仮定入力
  const loss = Math.floor(sales * share * disc);
  const exempt = baseSales > RULES.smallLimit
    ? { ok: false, why: '基準期間の課税売上が1,000万円超のため、すでに課税事業者です' }
    : { ok: true };
  results.push({ key: 'exempt', label: '登録しない（免税のまま）', tax: 0, indirect: loss, ...exempt });

  const reg = (key, label, tax, elig) =>
    results.push({ key, label, tax, indirect: 0, ...elig });

  const canSpecial = i.firstTime && baseSales <= RULES.smallLimit;
  const specialWhy = !i.firstTime ? '登録で初めて課税事業者になる個人のみ対象'
    : baseSales > RULES.smallLimit ? '基準期間の課税売上が1,000万円以下であることが必要' : null;

  reg('twenty', '登録＋2割特例', Math.floor(outTax * RULES.twentyPercent.rate),
    i.year > RULES.twentyPercent.lastYear ? { ok: false, why: `${RULES.twentyPercent.lastYear}年分で終了済み` }
      : canSpecial ? { ok: true } : { ok: false, why: specialWhy });
  reg('thirty', '登録＋3割特例（個人）', Math.floor(outTax * RULES.thirtyPercent.rate),
    !RULES.thirtyPercent.years.includes(i.year) ? { ok: false, why: `${RULES.thirtyPercent.years.join('・')}年分のみ` }
      : canSpecial ? { ok: true } : { ok: false, why: specialWhy });
  reg('simplified', `登録＋簡易課税（${RULES.deemed[cat].label}）`,
    Math.floor(outTax * (1 - RULES.deemed[cat].rate)),
    baseSales > RULES.simplifiedLimit ? { ok: false, why: '基準期間の課税売上が5,000万円超' }
      : { ok: true, note: '事前の届出が必要' });
  reg('standard', '登録＋本則課税', outTax - inTax, { ok: true });

  for (const r of results) r.total = r.tax + r.indirect;
  const okList = results.filter((r) => r.ok);
  // 同額の場合は表示順で先のもの（免税のまま→特例→簡易→本則）を優先
  const best = okList.length && sales > 0 ? okList.reduce((a, b) => (b.total < a.total ? b : a)) : null;
  return { results, best: best?.key ?? null, outTax, inTax };
}
