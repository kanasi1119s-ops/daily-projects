import { invoiceTotal, exemptPurchaseCredit, splitTax } from './calc.js';
const $ = (id) => document.getElementById(id);
const yen = (n) => '¥' + n.toLocaleString('ja-JP');
const parse = (s) => {
  const t = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，\s円¥]/g, '');
  if (!/^\d+$/.test(t)) throw new RangeError('金額は0以上の整数で入力してください');
  return Number(t);
};
const clear = (ids) => ids.forEach((i) => { $(i).textContent = '-'; });
function calc1() {
  try {
    const a = parse($('amt').value);
    const mode = $('mode').value, rate = Number($('rate').value), rounding = $('rnd').value;
    const net = mode === 'incl' ? splitTax(a, 'incl', rate, rounding).net : a;
    const t = invoiceTotal(net, { rate, rounding, withhold: $('wh').checked });
    $('o-net').textContent = yen(t.net); $('o-tax').textContent = yen(t.tax);
    $('o-gross').textContent = yen(t.gross); $('o-wh').textContent = yen(t.withholding);
    $('o-pay').textContent = yen(t.payout); $('err1').textContent = '';
  } catch (e) { clear(['o-net', 'o-tax', 'o-gross', 'o-wh', 'o-pay']); $('err1').textContent = e.message; }
}
function calc2() {
  try {
    const r = exemptPurchaseCredit(parse($('tax2').value), $('date2').value);
    $('p-rate').textContent = r.rate + '%'; $('p-ded').textContent = yen(r.deductible);
    $('p-non').textContent = yen(r.nonDeductible); $('err2').textContent = '';
  } catch (e) { clear(['p-rate', 'p-ded', 'p-non']); $('err2').textContent = e.message; }
}
const d = new Date();
$('date2').value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // ローカル日付
['amt', 'mode', 'rate', 'rnd', 'wh'].forEach((i) => $(i).addEventListener('input', calc1));
['tax2', 'date2'].forEach((i) => $(i).addEventListener('input', calc2));
calc1(); calc2();
