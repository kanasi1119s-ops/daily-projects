import { calculate, parseAmount, reverseFromPayable, type Item, type Options, type Rounding, type TaxRate, type WithholdingBase } from './calc';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const minus = (n: number) => (n === 0 ? yen(0) : `-${yen(n)}`);
const yen = (n: number) => `${n < 0 ? '-' : ''}¥${Math.abs(n).toLocaleString('ja-JP')}`;

const rows = $('rows');
function addRow(amount = '', rate: TaxRate = 10): void {
  const d = document.createElement('div');
  d.className = 'row';
  const a = document.createElement('input');
  a.type = 'text';
  a.inputMode = 'numeric';
  a.placeholder = '金額(円)';
  a.value = amount;
  a.setAttribute('aria-label', '金額');
  const s = document.createElement('select');
  s.setAttribute('aria-label', '税率');
  for (const r of [10, 8, 0]) {
    const o = document.createElement('option');
    o.value = String(r);
    o.textContent = r === 0 ? '非課税/不課税' : `${r}%`;
    s.append(o);
  }
  s.value = String(rate);
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'del';
  x.textContent = '×';
  x.setAttribute('aria-label', '明細を削除');
  x.onclick = () => {
    if (rows.children.length > 1) d.remove();
    else a.value = '';
    render();
  };
  d.append(a, s, x);
  rows.append(d);
}

function opts(): Options {
  return {
    rounding: $<HTMLSelectElement>('rounding').value as Rounding,
    taxIncludedInput: $<HTMLInputElement>('incl').checked,
    withholding: $<HTMLInputElement>('withholding').checked,
    withholdingBase: $<HTMLSelectElement>('wbase').value as WithholdingBase,
  };
}

let mode: 'fwd' | 'rev' = 'fwd';

function tr(label: string, val: string, cls = ''): HTMLTableRowElement {
  const r = document.createElement('tr');
  r.className = cls;
  const a = document.createElement('td');
  const b = document.createElement('td');
  a.textContent = label;
  b.textContent = val;
  r.append(a, b);
  return r;
}

function render(): void {
  const out = $('out');
  out.replaceChildren();
  const o = opts();
  $<HTMLSelectElement>('wbase').disabled = !o.withholding;
  const t = document.createElement('table');
  if (mode === 'fwd') {
    const items: Item[] = [];
    let bad = false;
    for (const row of Array.from(rows.children)) {
      const raw = (row.querySelector('input') as HTMLInputElement).value;
      if (raw.trim() === '') continue;
      const n = parseAmount(raw);
      if (Number.isNaN(n)) bad = true;
      else items.push({ amount: n, rate: Number((row.querySelector('select') as HTMLSelectElement).value) as TaxRate });
    }
    if (bad) {
      const p = document.createElement('p');
      p.className = 'err';
      p.textContent = '金額は0以上の整数で入力してください(最大12桁)。';
      out.append(p);
      return;
    }
    const r = calculate(items, o);
    for (const b of r.breakdown) t.append(tr(`${b.rate === 0 ? '非課税' : b.rate + '%'} 対象(税抜)`, yen(b.excl)), tr(`${b.rate === 0 ? '非課税' : b.rate + '%'} 消費税`, yen(b.tax)));
    t.append(tr('税抜合計', yen(r.subtotalExcl)), tr('消費税合計', yen(r.taxTotal)), tr('税込合計(請求額)', yen(r.totalIncl)));
    if (o.withholding) t.append(tr('源泉徴収税額', minus(r.withholding)));
    t.append(tr('お振込額', yen(r.payable), 'big'));
  } else {
    const n = parseAmount($<HTMLInputElement>('target').value);
    const r = Number.isNaN(n) ? null : reverseFromPayable(n, o);
    if (!r) {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = '振込額を1円以上の整数で入力してください。';
      out.append(p);
    } else {
      const c = calculate([{ amount: r.excl, rate: 10 }], { ...o, taxIncludedInput: false });
      t.append(tr('請求すべき税抜報酬額', yen(r.excl), 'big'), tr('消費税(10%)', yen(c.taxTotal)), tr('税込合計', yen(c.totalIncl)));
      if (o.withholding) t.append(tr('源泉徴収税額', minus(c.withholding)));
      t.append(tr('お振込額', yen(c.payable)));
    }
  }
  out.append(t);
  if (mode === 'rev') {
    const n = parseAmount($<HTMLInputElement>('target').value);
    const r = Number.isNaN(n) ? null : reverseFromPayable(n, o);
    if (r && !r.exact) {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = '※ 端数の都合で振込額がちょうどになる報酬額はありません。目標以上で最小の額を表示しています。';
      out.append(p);
    }
  }
}

function setMode(m: 'fwd' | 'rev'): void {
  mode = m;
  $('fwd').hidden = m !== 'fwd';
  $('rev').hidden = m !== 'rev';
  $('tab-fwd').setAttribute('aria-selected', String(m === 'fwd'));
  $('tab-rev').setAttribute('aria-selected', String(m === 'rev'));
  render();
}

addRow();
$('add').onclick = () => { addRow(); render(); };
$('tab-fwd').onclick = () => setMode('fwd');
$('tab-rev').onclick = () => setMode('rev');
document.addEventListener('input', render);
document.addEventListener('change', render);
render();
