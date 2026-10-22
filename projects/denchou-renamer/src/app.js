import { buildFileName, dedupeNames, toCsv, makeZip } from './core.js';

const MAX_TOTAL = 1024 * 1024 * 1024; // STORE形式ZIPは32bit上限のため1GBで制限
const items = []; // {file, date, vendor, amount}
const $ = (s) => document.querySelector(s);
const tbody = $('#rows');

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function compute() {
  const built = items.map((it) => buildFileName({ ...it, originalName: it.file.name }));
  const okIdx = built.map((b, i) => (b.ok ? i : -1)).filter((i) => i >= 0);
  const names = dedupeNames(okIdx.map((i) => built[i].name));
  okIdx.forEach((i, k) => { built[i].name = names[k]; });
  return built;
}

function render() {
  const built = compute();
  tbody.innerHTML = items.map((it, i) => {
    const b = built[i];
    return `<tr>
      <td class="orig" title="${esc(it.file.name)}">${esc(it.file.name)}</td>
      <td><input data-i="${i}" data-k="date" value="${esc(it.date)}" placeholder="2026-04-01" aria-label="取引年月日"></td>
      <td><input data-i="${i}" data-k="vendor" value="${esc(it.vendor)}" placeholder="株式会社〇〇" aria-label="取引先"></td>
      <td><input data-i="${i}" data-k="amount" value="${esc(it.amount)}" inputmode="numeric" placeholder="110000" aria-label="金額"></td>
      <td class="${b.ok ? 'ok' : 'ng'}">${b.ok ? esc(b.name) : esc(b.errors.join(' / '))}</td>
      <td><button data-del="${i}" aria-label="削除">✕</button></td></tr>`;
  }).join('');
  const okCount = built.filter((b) => b.ok).length;
  $('#count').textContent = `${items.length}件 (変換可能 ${okCount}件)`;
  $('#dl-zip').disabled = $('#dl-csv').disabled = okCount === 0;
  $('#table-wrap').hidden = items.length === 0;
}

function addFiles(list) {
  let total = items.reduce((n, it) => n + it.file.size, 0);
  const skipped = [];
  for (const f of list) {
    if (total + f.size > MAX_TOTAL) { skipped.push(f.name); continue; }
    total += f.size;
    items.push({ file: f, date: '', vendor: '', amount: '' });
  }
  $('#warn').textContent = skipped.length ? `合計1GBを超えるため追加できませんでした: ${skipped.join(', ')}` : '';
  render();
}

tbody.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.i === undefined) return;
  items[Number(t.dataset.i)][t.dataset.k] = t.value;
  // 入力中のフォーカスを維持するため結果セルのみ更新
  const built = compute();
  const row = t.closest('tr');
  const b = built[Number(t.dataset.i)];
  const cell = row.querySelector('td:nth-child(5)');
  cell.className = b.ok ? 'ok' : 'ng';
  cell.textContent = b.ok ? b.name : b.errors.join(' / ');
  const okCount = built.filter((x) => x.ok).length;
  $('#count').textContent = `${items.length}件 (変換可能 ${okCount}件)`;
  $('#dl-zip').disabled = $('#dl-csv').disabled = okCount === 0;
});
tbody.addEventListener('click', (e) => {
  const i = e.target.dataset.del;
  if (i === undefined) return;
  items.splice(Number(i), 1);
  render();
});

const drop = $('#drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
$('#picker').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function validRows() {
  const built = compute();
  return built.map((b, i) => (b.ok ? { ...b, originalName: items[i].file.name, file: items[i].file } : null)).filter(Boolean);
}

$('#dl-csv').addEventListener('click', () => {
  download(new Blob([toCsv(validRows())], { type: 'text/csv;charset=utf-8' }), '検索簿.csv');
});
$('#dl-zip').addEventListener('click', async () => {
  const rows = validRows();
  if (!rows.length) return;
  const files = [];
  for (const r of rows) files.push({ name: r.name, data: new Uint8Array(await r.file.arrayBuffer()) });
  files.push({ name: '検索簿.csv', data: new TextEncoder().encode(toCsv(rows)) });
  download(new Blob([makeZip(files)], { type: 'application/zip' }), 'renamed.zip');
});
render();
