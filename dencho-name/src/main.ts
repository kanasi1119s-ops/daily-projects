import { DEFAULT_TEMPLATE, Entry, buildFileName, dedupe } from './naming';
import { toCsv } from './csv';
import { makeZip } from './zip';

interface Item { id: number; file: File; entry: Entry }

const MAX_FILES = 200;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;
let items: Item[] = [];
let nextId = 1;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const rowsEl = $('rows');
const dl = $<HTMLButtonElement>('download');
const statusEl = $('status');
const tplEl = $<HTMLSelectElement>('template');

function addFiles(list: FileList | File[]) {
  const arr = Array.from(list);
  const total = items.reduce((a, i) => a + i.file.size, 0) + arr.reduce((a, f) => a + f.size, 0);
  if (items.length + arr.length > MAX_FILES || total > MAX_TOTAL_BYTES) {
    statusEl.textContent = `一度に扱えるのは${MAX_FILES}ファイル・合計500MBまでです。分けて処理してください。`;
    return;
  }
  for (const file of arr) {
    items.push({ id: nextId++, file, entry: { originalName: file.name, date: '', docType: '請求書', vendor: '', amount: '' } });
  }
  statusEl.textContent = '';
  render();
}

function results() {
  const built = items.map((i) => buildFileName(i.entry, tplEl.value || DEFAULT_TEMPLATE));
  const ok = built.filter((b) => b.name).map((b) => b.name as string);
  const finals = dedupe(ok);
  let k = 0;
  return built.map((b) => ({ ...b, name: b.name ? finals[k++] : null }));
}

function field(item: Item, key: keyof Entry, label: string, ph: string, list?: string): HTMLElement {
  const wrap = document.createElement('div');
  const lab = document.createElement('label');
  lab.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = item.entry[key];
  input.placeholder = ph;
  if (list) input.setAttribute('list', list);
  input.addEventListener('input', () => { item.entry[key] = input.value; updatePreview(); });
  lab.appendChild(input);
  wrap.appendChild(lab);
  return wrap;
}

const outEls = new Map<number, HTMLElement>();

function updatePreview() {
  const res = results();
  items.forEach((it, idx) => {
    const el = outEls.get(it.id);
    if (!el) return;
    const r = res[idx];
    el.textContent = r.name ?? r.errors.join(' / ');
    el.classList.toggle('bad', !r.name);
  });
  const allOk = items.length > 0 && res.every((r) => r.name);
  dl.disabled = !allOk;
}

function render() {
  rowsEl.replaceChildren();
  outEls.clear();
  for (const it of items) {
    const row = document.createElement('div');
    row.className = 'row';
    const orig = document.createElement('div');
    orig.className = 'orig';
    const nm = document.createElement('span');
    nm.textContent = `元: ${it.file.name}`;
    const rm = document.createElement('button');
    rm.type = 'button'; rm.className = 'rm'; rm.textContent = '×'; rm.setAttribute('aria-label', `${it.file.name}を外す`);
    rm.addEventListener('click', () => { items = items.filter((x) => x.id !== it.id); render(); });
    orig.append(nm, rm);
    const out = document.createElement('div');
    out.className = 'out';
    outEls.set(it.id, out);
    row.append(
      orig,
      field(it, 'date', '取引年月日', '2026-11-12 / 令和8年11月12日'),
      field(it, 'docType', '書類種別', '請求書', 'types'),
      field(it, 'vendor', '取引先', '株式会社サンプル'),
      field(it, 'amount', '金額(円)', '110,000'),
      out,
    );
    rowsEl.appendChild(row);
  }
  updatePreview();
}

async function download() {
  dl.disabled = true;
  statusEl.textContent = '作成中…';
  try {
    const res = results();
    const files = [];
    const rows: string[][] = [['取引年月日', '書類種別', '取引先', '金額(円)', '保存ファイル名', '元のファイル名']];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = res[i].name as string;
      files.push({ name, data: new Uint8Array(await it.file.arrayBuffer()) });
      const e = it.entry;
      rows.push([e.date, e.docType, e.vendor, e.amount, name, it.file.name]);
    }
    const csvName = dedupe([...files.map((f) => f.name), '索引簿.csv']).pop() as string;
    files.push({ name: csvName, data: new TextEncoder().encode(toCsv(rows)) });
    const blob = new Blob([makeZip(files) as BlobPart], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dencho-name-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    statusEl.textContent = `${items.length}件をZIPにまとめました。元ファイルは変更されていません。`;
  } catch (err) {
    statusEl.textContent = 'ZIP作成に失敗しました。ファイル数・サイズを減らして再度お試しください。';
    console.error(err);
  } finally {
    updatePreview();
  }
}

const drop = $('drop');
const picker = $<HTMLInputElement>('picker');
drop.addEventListener('click', () => picker.click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); } });
picker.addEventListener('change', () => { if (picker.files) addFiles(picker.files); picker.value = ''; });
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer) addFiles(e.dataTransfer.files); });
tplEl.addEventListener('change', updatePreview);
dl.addEventListener('click', download);
$('clear').addEventListener('click', () => { items = []; statusEl.textContent = ''; render(); });
render();
