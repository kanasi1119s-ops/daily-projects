import { DOC_TYPES, buildName, dedupeNames, buildCsv, buildZip, normalizeDate, parseAmount, sanitizePart } from './lib.js';

const $ = (id) => document.getElementById(id);
const items = []; // {id,file,date,partner,amount,docType}
let seq = 0;

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function compute() {
  const built = items.map((it) => buildName({ ...it, original: it.file.name }));
  const names = dedupeNames(built.map((b) => (b.ok ? b.name : null)));
  return items.map((it, i) => ({ it, b: built[i], name: names[i] }));
}

function render() {
  const rows = compute();
  const list = $('list');
  list.textContent = '';
  rows.forEach(({ it, b, name }) => {
    const el = document.createElement('div');
    el.className = 'row';
    el.innerHTML = `
      <div class="orig">元: ${esc(it.file.name)}</div>
      <label>日付<input data-k="date" data-id="${it.id}" value="${esc(it.date)}" placeholder="2026-10-14"></label>
      <label>取引先<input data-k="partner" data-id="${it.id}" value="${esc(it.partner)}"></label>
      <label>金額(円)<input data-k="amount" data-id="${it.id}" value="${esc(it.amount)}" inputmode="numeric"></label>
      <label>種別<select data-k="docType" data-id="${it.id}">${DOC_TYPES.map((t) => `<option${t === it.docType ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <div class="out"></div>
      <div class="err"></div>
      <button data-rm="${it.id}">削除</button>`;
    list.appendChild(el);
  });
  refreshOutputs(rows);
}

// 入力中はDOMを作り直さず、出力・エラー・ボタン状態のみ更新（フォーカス維持）
function refreshOutputs(rows = compute()) {
  const els = $('list').children;
  rows.forEach(({ b, name }, i) => {
    els[i].querySelector('.out').textContent = b.ok ? '→ ' + name : '';
    els[i].querySelector('.err').textContent = b.ok ? '' : b.errors.join(' / ');
  });
  const allOk = rows.length > 0 && rows.every((r) => r.b.ok);
  $('zip').disabled = !allOk;
  $('csv').disabled = !allOk;
  $('clear').disabled = rows.length === 0;
}

function addFiles(files) {
  for (const file of files) items.push({ id: ++seq, file, date: '', partner: '', amount: '', docType: '請求書' });
  render();
}

$('list').addEventListener('input', (e) => {
  const t = e.target;
  const it = items.find((x) => x.id === Number(t.dataset.id));
  if (!it) return;
  it[t.dataset.k] = t.value;
  refreshOutputs();
});
$('list').addEventListener('click', (e) => {
  const id = e.target.dataset?.rm;
  if (!id) return;
  items.splice(items.findIndex((x) => x.id === Number(id)), 1);
  render();
});

const drop = $('drop');
drop.addEventListener('click', () => $('picker').click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('picker').click(); } });
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
$('picker').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
$('clear').addEventListener('click', () => { items.length = 0; render(); });

function csvRows() {
  return compute().map(({ it, name }) => ({
    name, date: normalizeDate(it.date), amount: parseAmount(it.amount),
    partner: sanitizePart(it.partner), docType: it.docType, original: it.file.name,
  }));
}
function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('csv').addEventListener('click', () => {
  download(new Blob([buildCsv(csvRows())], { type: 'text/csv;charset=utf-8' }), '索引簿.csv');
});
$('zip').addEventListener('click', async () => {
  const rows = compute();
  const files = [];
  for (const { it, name } of rows) files.push({ name, data: new Uint8Array(await it.file.arrayBuffer()) });
  files.push({ name: '索引簿.csv', data: new TextEncoder().encode(buildCsv(csvRows())) });
  download(new Blob([buildZip(files)], { type: 'application/zip' }), 'renamed.zip');
});
