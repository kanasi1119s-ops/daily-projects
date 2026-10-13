import { simulate, BUSINESS_TYPES } from './tax.js';
import { parseYen } from './parse.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ja-JP')}円`;

for (const [k, v] of Object.entries(BUSINESS_TYPES)) {
  const o = document.createElement('option');
  o.value = k;
  o.textContent = v.label;
  if (k === '5') o.selected = true;
  $('type').append(o);
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const r = simulate({
    sales: parseYen($('sales').value),
    purchases: $('purchases').value.trim() === '' ? 0 : parseYen($('purchases').value),
    businessType: Number($('type').value),
    taxYear: Number($('year').value),
    wasExempt: $('wasExempt').checked,
    baseYearSales: $('base').value.trim() === '' ? undefined : parseYen($('base').value),
  });
  const err = $('error');
  if ($('sales').value.trim() === '') r.errors = ['課税売上（税込・年間）を入力してください。'];
  const res = $('result');
  if (!r.ok) {
    err.textContent = r.errors.join(' ');
    err.hidden = false;
    res.hidden = true;
    return;
  }
  err.hidden = true;
  const rows = $('rows');
  rows.replaceChildren();
  for (const m of r.methods) {
    const tr = document.createElement('tr');
    if (!m.eligible) tr.className = 'off';
    else if (m.key === r.bestKey) tr.className = 'best';
    const cells = [
      m.label + (m.key === r.bestKey && m.eligible ? '（最少）' : ''),
      m.eligible ? yen(m.tax) : '対象外',
      m.note,
    ];
    cells.forEach((t, i) => {
      const td = document.createElement('td');
      td.textContent = t;
      if (i === 1) td.className = 'num';
      tr.append(td);
    });
    rows.append(tr);
  }
  const best = r.methods.find((m) => m.key === r.bestKey);
  $('summary').textContent = `最も納税額が少ない方式は「${best.label}」で約${yen(best.tax)}です。` +
    (r.saving > 0 ? `選べる方式の中で最大${yen(r.saving)}の差があります。` : '');
  $('meta').textContent = `売上に含まれる消費税: ${yen(r.outputTax)} ／ 仕入に含まれる消費税: ${yen(r.inputTax)}。` +
    '100円未満切捨ての概算で、地方消費税を含みます。';
  res.hidden = false;
});
