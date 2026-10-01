import { buildFilename, dedupe, toCsv, makeZip, normalizeDate } from './lib.js';

const KINDS = ['', '領収書', '請求書', '見積書', '契約書', '納品書', 'その他'];
const $ = (id) => document.getElementById(id);
/** @type {{file: File, date: string, partner: string, amount: string, kind: string}[]} */
let items = [];

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

function compute() {
  const built = items.map((it) => buildFilename({ originalName: it.file.name, ...it }));
  const okIdx = built.map((b, i) => (b.ok ? i : -1)).filter((i) => i >= 0);
  const names = dedupe(okIdx.map((i) => built[i].filename));
  okIdx.forEach((i, n) => { built[i].filename = names[n]; });
  return built;
}

function render() {
  const built = compute();
  const rows = $('rows');
  rows.replaceChildren();
  items.forEach((it, i) => {
    const bind = (key, input) => {
      input.value = it[key];
      input.addEventListener('input', () => { it[key] = input.value; update(); });
      return el('td', {}, input);
    };
    const kind = el('select');
    KINDS.forEach((k) => kind.append(el('option', { value: k, textContent: k || '(なし)' })));
    const out = el('td', { className: 'name', id: `out-${i}` });
    const del = el('button', { className: 'sub', textContent: '削除', type: 'button' });
    del.addEventListener('click', () => { items.splice(i, 1); render(); });
    rows.append(el('tr', {},
      el('td', { textContent: it.file.name, className: 'name' }),
      bind('date', el('input', { placeholder: '2026-04-01', inputMode: 'numeric' })),
      bind('partner', el('input', { placeholder: '株式会社〇〇' })),
      bind('amount', el('input', { placeholder: '12,800', inputMode: 'numeric' })),
      bind('kind', kind),
      out,
      el('td', {}, del)));
  });
  $('tablewrap').hidden = $('actions').hidden = items.length === 0;
  update(built);
}

function update(built = compute()) {
  built.forEach((b, i) => {
    const out = $(`out-${i}`);
    if (!out) return;
    out.replaceChildren(b.ok ? document.createTextNode(b.filename)
      : el('span', { className: 'err', textContent: b.errors.join(' / ') }));
  });
  $('zip').disabled = items.length === 0 || built.some((b) => !b.ok);
}

function addFiles(list) {
  for (const file of list) items.push({ file, date: '', partner: '', amount: '', kind: '' });
  render();
}

function localToday() {
  const d = new Date();
  return normalizeDate(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
}

const MAX_TOTAL_BYTES = 500 * 1024 * 1024; // 非ZIP64・メモリ保護のための上限

async function download() {
  const built = compute();
  if (built.some((b) => !b.ok)) return;
  if (items.reduce((s, it) => s + it.file.size, 0) > MAX_TOTAL_BYTES) {
    alert('合計サイズが500MBを超えています。複数回に分けて処理してください。');
    return;
  }
  try {
    await buildAndSave(built);
  } catch (e) {
    alert('ファイルの読み込みまたはZIP作成に失敗しました: ' + (e?.message || e));
  }
}

async function buildAndSave(built) {
  const entries = [];
  const csvRows = [];
  for (let i = 0; i < items.length; i++) {
    entries.push({ name: built[i].filename, data: new Uint8Array(await items[i].file.arrayBuffer()) });
    csvRows.push({ ...built[i].meta, filename: built[i].filename, originalName: items[i].file.name });
  }
  entries.push({ name: '索引.csv', data: new TextEncoder().encode(toCsv(csvRows)) });
  const blob = new Blob([makeZip(entries)], { type: 'application/zip' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `denchoho_${localToday()}.zip` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

const drop = $('drop');
drop.addEventListener('click', () => $('picker').click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') $('picker').click(); });
$('picker').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
$('zip').addEventListener('click', download);
$('clear').addEventListener('click', () => { items = []; render(); });
