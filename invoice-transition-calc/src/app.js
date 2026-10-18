import { calcLine, projection, parseAmount } from './calc.js';
import { RATES_SOURCE } from './rates.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => n.toLocaleString('ja-JP');
const tbody = $('lines').tBodies[0];
$('src').href = RATES_SOURCE;

function addRow(date = '2026-10-15', amount = '110,000', rate = '10') {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><input type="date" value="${date}" aria-label="取引日"></td>
    <td><input inputmode="numeric" value="${amount}" aria-label="税込金額" size="10"></td>
    <td><select aria-label="税率"><option value="10">10%</option><option value="8">8%</option></select></td>
    <td class="c-rate"></td><td class="c-tax"></td><td class="c-ded"></td><td class="c-non"></td>
    <td><button type="button" class="sub" aria-label="行を削除">×</button></td>`;
  tr.querySelector('select').value = rate;
  tr.querySelector('button').addEventListener('click', () => { tr.remove(); render(); });
  tbody.appendChild(tr);
}

function render() {
  let tax = 0, ded = 0, non = 0, errs = [];
  [...tbody.rows].forEach((tr, i) => {
    const [d, a] = tr.querySelectorAll('input');
    const set = (c, v) => (tr.querySelector(c).textContent = v);
    try {
      const r = calcLine({ amount: a.value, taxRate: Number(tr.querySelector('select').value), date: d.value, smallAmountSpecial: $('small').checked });
      set('.c-rate', `${r.rate * 100}%${r.rule === 'small' ? '(少額)' : ''}`);
      set('.c-tax', yen(r.tax)); set('.c-ded', yen(r.deductible)); set('.c-non', yen(r.nonDeductible));
      tax += r.tax; ded += r.deductible; non += r.nonDeductible;
    } catch (e) {
      ['.c-rate', '.c-tax', '.c-ded', '.c-non'].forEach((c) => set(c, '-'));
      errs.push(`${i + 1}行目: ${e.message}`);
    }
  });
  $('t-tax').textContent = yen(tax); $('t-ded').textContent = yen(ded); $('t-non').textContent = yen(non);
  $('err').textContent = errs.join(' / ');

  const pb = $('proj').tBodies[0];
  pb.innerHTML = '';
  $('err2').textContent = '';
  try {
    for (const r of projection($('annual').value, Number($('annual-rate').value))) {
      const tr = pb.insertRow();
      [r.label, `${r.rate * 100}%`, yen(r.tax), yen(r.deductible), yen(r.nonDeductible)].forEach((v) => (tr.insertCell().textContent = v));
    }
  } catch (e) { $('err2').textContent = `年間支払額: ${e.message}`; }
}

document.addEventListener('input', render);
document.addEventListener('change', render);
$('add').addEventListener('click', () => { addRow(); render(); });
addRow(); addRow('2026-09-20', '55,000'); render();
export { parseAmount };
