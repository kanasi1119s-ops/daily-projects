import { compare } from './calc.js';
import { RULES } from './rules.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ja-JP') + '円';

$('category').innerHTML = Object.entries(RULES.deemed)
  .map(([k, v]) => `<option value="${k}"${k === '5' ? ' selected' : ''}>${v.label}</option>`).join('');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render() {
  const r = compare({
    sales: $('sales').valueAsNumber, purchases: $('purchases').valueAsNumber,
    baseSales: $('baseSales').valueAsNumber, year: Number($('year').value),
    category: Number($('category').value), invoiceShare: $('invoiceShare').valueAsNumber,
    discountPct: $('discountPct').valueAsNumber, firstTime: $('firstTime').value === '1',
  });
  if (!(r.outTax > 0)) { $('out').innerHTML = '<p>年間の課税売上を入力すると比較結果が表示されます。</p>'; return; }
  const hint = $('firstTime').value === '1' && $('baseSales').valueAsNumber > RULES.smallLimit
    ? '<p class="warn">2年前の課税売上が1,000万円を超える場合、通常すでに課税事業者です。「登録で初めて課税事業者」の選択と矛盾していないかご確認ください。</p>' : '';
  $('out').innerHTML = hint + r.results.map((x) => {
    const cls = !x.ok ? 'res ng' : x.key === r.best ? 'res best' : 'res';
    const detail = x.ok
      ? `消費税 ${yen(x.tax)}${x.tax < 0 ? '（還付見込み）' : ''}${x.indirect ? ` ＋ 想定値引き等 ${yen(x.indirect)}` : ''}${x.note ? `（${esc(x.note)}）` : ''}`
      : `適用不可：${esc(x.why)}`;
    return `<div class="${cls}"><div>${esc(x.label)}${x.key === r.best ? ' ★目安で最小' : ''}<div class="sub">${detail}</div></div>` +
      `<div>${x.ok ? yen(x.total) : '—'}</div></div>`;
  }).join('');
}
$('f').addEventListener('input', render);
$('f').addEventListener('submit', (e) => e.preventDefault());
render();
