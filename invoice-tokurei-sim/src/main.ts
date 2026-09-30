import './style.css';
import {
  BUSINESS_TYPE_LABEL,
  MAX_YEN,
  compare,
  weightedExemptDeductionRate,
  type BusinessType,
  type Input,
  type MethodId,
  type Taxpayer,
} from './calc';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
};
const num = (id: string): number => {
  const v = Number($<HTMLInputElement>(id).value);
  return Number.isFinite(v) && v > 0 ? Math.min(Math.floor(v), MAX_YEN) : 0;
};
const fmt = (n: number): string => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('ja-JP')}円`;

const typeSel = $<HTMLSelectElement>('businessType');
for (const [k, v] of Object.entries(BUSINESS_TYPE_LABEL)) {
  const o = document.createElement('option');
  o.value = k;
  o.textContent = v;
  if (k === '5') o.selected = true;
  typeSel.append(o);
}

function readInput(): Input {
  const taxpayer = $<HTMLSelectElement>('taxpayer').value as Taxpayer;
  let periodStart: string;
  let periodEnd: string;
  if (taxpayer === 'individual') {
    const y = $<HTMLSelectElement>('year').value;
    periodStart = `${y}-01-01`;
    periodEnd = `${y}-12-31`;
  } else {
    periodStart = $<HTMLInputElement>('periodStart').value;
    periodEnd = $<HTMLInputElement>('periodEnd').value;
  }
  const sel = $<HTMLSelectElement>('exemptRate').value;
  const auto = /^\d{4}-\d{2}-\d{2}$/.test(periodStart);
  return {
    salesStd: num('salesStd'),
    salesReduced: num('salesReduced'),
    purchasesStd: num('purchasesStd'),
    purchasesReduced: num('purchasesReduced'),
    exemptPurchasesStd: num('exemptPurchasesStd'),
    exemptPurchasesReduced: num('exemptPurchasesReduced'),
    exemptDeductionRate: sel === 'auto' ? (auto ? weightedExemptDeductionRate(periodStart, periodEnd) : 0) : Number(sel),
    businessType: Number(typeSel.value) as BusinessType,
    taxpayer,
    periodStart,
    periodEnd,
    registeredFromExempt: $<HTMLInputElement>('registeredFromExempt').checked,
    baseSales: num('baseSales'),
  };
}

const NAMES: Record<MethodId, string> = {
  standard: '本則課税',
  simplified: '簡易課税',
  twenty: '2割特例',
  thirty: '3割特例',
};

function render(): void {
  const isIndividual = $<HTMLSelectElement>('taxpayer').value === 'individual';
  document.querySelectorAll<HTMLElement>('.corp').forEach((e) => (e.hidden = isIndividual));
  $('yearWrap').hidden = !isIndividual;

  const input = readInput();
  const c = compare(input);
  $('errors').textContent = c.warnings.join(' ');
  $('rateHint').textContent = /^\d{4}-\d{2}-\d{2}$/.test(input.periodStart)
    ? `適用する控除割合: ${Math.round(input.exemptDeductionRate * 100)}%（期間中に割合が切り替わる場合は日数で按分した概算です。仕入時期に偏りがある場合は割合を手動で選んでください）`
    : '';

  const cheapest = c.results.find((r) => r.id === c.cheapestId);
  $('summary').textContent = cheapest
    ? `売上税額 ${fmt(c.salesTax)}。対象となる方法のうち、試算上の負担が最も小さいのは「${NAMES[cheapest.id]}」（${cheapest.tax < 0 ? `${fmt(-cheapest.tax)}の還付見込み` : `納付${fmt(cheapest.tax)}`}）です。`
    : `売上税額 ${fmt(c.salesTax)}。入力内容を確認してください。`;

  const root = $('results');
  root.replaceChildren();
  const max = Math.max(1, ...c.results.filter((r) => r.eligible).map((r) => r.tax));
  for (const r of c.results) {
    const row = document.createElement('article');
    row.className = 'method' + (r.eligible ? '' : ' off') + (r.id === c.cheapestId ? ' best' : '');
    const head = document.createElement('h3');
    head.textContent = r.label;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = r.id === c.cheapestId ? '試算上いちばん小さい' : r.eligible ? '対象' : '対象外（参考値）';
    head.append(tag);
    const amt = document.createElement('p');
    amt.className = 'amt';
    amt.textContent = r.tax < 0 ? `${fmt(-r.tax)}（還付見込み）` : fmt(r.tax);
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('i');
    fill.style.width = r.eligible && r.tax > 0 ? `${Math.round((r.tax / max) * 100)}%` : '0%';
    bar.append(fill);
    const notes = document.createElement('ul');
    for (const n of r.notes) {
      const li = document.createElement('li');
      li.textContent = n;
      notes.append(li);
    }
    row.append(head, amt, bar, notes);
    root.append(row);
  }
}

$('form').addEventListener('input', render);
$('form').addEventListener('change', render);
$('form').addEventListener('submit', (e) => e.preventDefault());
render();
