import { decodeBuffer, parseCSV, detectColumns } from './csv.js';
import { toTransactions, detectRecurring, buildICS } from './detect.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => '¥' + n.toLocaleString('ja-JP');
const CYC = { weekly: '毎週', monthly: '毎月', yearly: '毎年' };
const fmt = (d) => d.toISOString().slice(0, 10);
let rows = null, found = [];

function say(t, err = false) { const m = $('msg'); m.textContent = t; m.className = err ? 'err' : ''; }

function fillSelects(cols) {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0); // spread不使用(巨大CSVでRangeError回避)
  for (const [id, key] of [['c-date', 'date'], ['c-desc', 'desc'], ['c-amt', 'amt']]) {
    const s = $(id); s.innerHTML = '';
    for (let i = 0; i < w; i++) {
      const o = document.createElement('option');
      o.value = i; o.textContent = `列${i + 1}: ${(rows[cols.headerRow]?.[i] ?? '').slice(0, 12)}`;
      s.appendChild(o);
    }
    s.value = cols[key];
  }
  $('colbox').hidden = false;
}

function analyze(cols) {
  const txs = toTransactions(rows, cols);
  if (!txs.length) { say('取引を読み取れませんでした。列の割り当てを確認してください。', true); $('result').hidden = true; return; }
  found = detectRecurring(txs);
  render(txs.length);
}

function render(n) {
  $('result').hidden = false;
  const tb = $('rows'); tb.innerHTML = '';
  const total = found.reduce((s, f) => s + f.annual, 0);
  $('summary').textContent = found.length
    ? `${n}件の取引から${found.length}件の定期支払いを検出。年間合計の目安は ${yen(total)} です。`
    : `${n}件の取引を読みましたが、定期支払いは見つかりませんでした。期間が短い(2か月以上推奨)可能性があります。`;
  found.forEach((f, i) => {
    const tr = document.createElement('tr');
    const cells = [null, f.label + (f.confidence < 0.7 ? '(要確認:回数少)' : ''), CYC[f.cycle], yen(f.amount), yen(f.annual), fmt(f.next)];
    cells.forEach((c, j) => {
      const td = document.createElement('td');
      if (j === 0) {
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true; cb.dataset.i = i;
        cb.setAttribute('aria-label', f.label + 'を選択'); td.appendChild(cb);
      } else td.textContent = c;   // textContentで挿入(XSS対策)
      if (j >= 3) td.className = 'n';
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  $('ics').disabled = !found.length;
}

function load(text) {
  rows = parseCSV(text);
  if (!rows.length) { say('空のファイルです。', true); $('result').hidden = true; return; }
  const cols = detectColumns(rows);
  if (!cols) {
    say('日付・内容・金額の列を自動判定できませんでした。手動で割り当ててください。', true);
    cols0();
    return;
  }
  say(`${rows.length}行を読み込みました。`);
  fillSelects(cols);
  analyze(cols);
}
function cols0() { if (rows?.length) { fillSelects({ headerRow: 0, date: 0, desc: 1, amt: 2 }); } }

$('file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  load(decodeBuffer(await f.arrayBuffer()));
});
$('reapply').addEventListener('click', () => analyze({ headerRow: detectColumns(rows)?.headerRow ?? 0, date: +$('c-date').value, desc: +$('c-desc').value, amt: +$('c-amt').value }));
$('sample').addEventListener('click', async () => {
  try {
    const r = await fetch('sample/sample.csv');
    if (!r.ok) throw new Error(r.status);
    load(await r.text());
  } catch { say('サンプルを読み込めませんでした。ローカルサーバー(npm start)経由で開いてください。', true); }
});
$('ics').addEventListener('click', () => {
  const sel = [...document.querySelectorAll('#rows input:checked')].map((c) => found[+c.dataset.i]);
  if (!sel.length) return say('項目を選択してください。', true);
  const url = URL.createObjectURL(new Blob([buildICS(sel)], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'subscan-reminders.ics' });
  a.click(); URL.revokeObjectURL(url);
});
