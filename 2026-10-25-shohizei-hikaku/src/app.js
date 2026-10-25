import { compare, sensitivity, split, checklist, DEEMED_RATES } from './calc.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ja-JP')}円`;

for (const [k, v] of Object.entries(DEEMED_RATES)) {
  $('category').add(new Option(`${v.label} ${v.rate * 100}%`, k, false, k === '5'));
}

function read() {
  return {
    sales10: $('sales10').value, sales8: $('sales8').value,
    purchase10: $('purchase10').value, purchase8: $('purchase8').value,
    category: Number($('category').value),
    eligible: { twenty: $('twenty').checked, thirty: $('thirty').checked, simplified: $('simplified').checked },
  };
}

function cell(text, cls) {
  const td = document.createElement('td');
  td.textContent = text;
  if (cls) td.className = cls;
  return td;
}

function render() {
  const input = read();
  const out = compare(input);
  const tbody = $('result').tBodies[0];
  tbody.replaceChildren();
  for (const r of out.results) {
    const tr = document.createElement('tr');
    if (r.eligible && r.key === out.bestKey) tr.className = 'best';
    tr.append(cell(r.label));
    if (!r.eligible) {
      tr.append(cell('対象外(未チェック)', 'na'), cell('-', 'na'), cell('-', 'na'));
    } else {
      const s = r.refund ? null : split(r.tax);
      tr.append(cell(r.refund ? `還付 ${yen(-r.tax)}` : yen(r.tax)), cell(s ? yen(s.national) : '-'), cell(s ? yen(s.local) : '-'));
    }
    tbody.append(tr);
  }
  const best = out.results.find((r) => r.key === out.bestKey);
  const general = out.results[0];
  const diff = general.tax - best.tax;
  $('summary').textContent = out.salesTax === 0 && out.purchaseTax === 0
    ? '金額を入力すると比較結果が表示されます。'
    : best.key === 'general'
    ? (general.refund
      ? `入力条件では原則課税で約${yen(-general.tax)}の還付見込みです(課税事業者の場合。概算)。`
      : '入力条件では原則課税の納付税額が最も小さい(または他方式が対象外)です。')
    : `入力条件では「${best.label}」が最も小さく、原則課税との差は約${yen(diff)}です(概算)。`;

  // 感度表
  const rows = sensitivity(input);
  const thead = $('sens').tHead;
  thead.replaceChildren();
  const hr = document.createElement('tr');
  const th0 = document.createElement('th'); th0.textContent = '仕入率'; hr.append(th0);
  for (const r of out.results) { const th = document.createElement('th'); th.textContent = r.label.replace(/\(.*\)/, ''); hr.append(th); }
  thead.append(hr);
  const sb = $('sens').tBodies[0];
  sb.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.append(cell(`${Math.round(row.ratio * 100)}%`));
    for (const r of row.results) {
      tr.append(cell(r.eligible ? yen(r.tax) : '-', r.eligible ? (r.key === row.bestKey ? 'best' : '') : 'na'));
    }
    sb.append(tr);
  }
}

for (const el of document.querySelectorAll('input, select')) el.addEventListener('input', render);
for (const t of checklist()) { const li = document.createElement('li'); li.textContent = t; $('checklist').append(li); }
render();
