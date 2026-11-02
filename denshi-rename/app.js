import { buildFileName, dedupeNames, validateRow, buildLedgerCsv, buildZip } from './src/core.js';

const DOC_TYPES = ['請求書', '領収書', '見積書', '注文書', '納品書', '契約書', 'その他'];
const MAX_TOTAL = 200 * 1024 * 1024; // ブラウザメモリ保護
const items = []; // {file,row}
const $ = (id) => document.getElementById(id);

function addFiles(list) {
  for (const file of list) items.push({ file, row: { date: '', partner: '', amount: '', docType: '請求書', note: '' } });
  render();
}

function names() {
  return dedupeNames(items.map((it) => buildFileName(it.row, it.file.name)));
}

function render() {
  $('listSection').hidden = items.length === 0;
  const tbody = $('rows');
  tbody.replaceChildren();
  items.forEach((it, i) => {
    const tr = document.createElement('tr');
    const td0 = document.createElement('td'); td0.textContent = it.file.name;
    tr.append(td0);
    for (const key of ['date', 'partner', 'amount']) {
      const td = document.createElement('td');
      const inp = document.createElement('input');
      inp.value = it.row[key];
      inp.placeholder = { date: '2026-11-02', partner: '株式会社〇〇', amount: '110000' }[key];
      inp.setAttribute('aria-label', key);
      inp.addEventListener('input', () => { it.row[key] = inp.value; update(); });
      td.append(inp); tr.append(td);
    }
    const tdT = document.createElement('td');
    const sel = document.createElement('select');
    for (const t of DOC_TYPES) sel.append(new Option(t, t, false, t === it.row.docType));
    sel.addEventListener('change', () => { it.row.docType = sel.value; });
    tdT.append(sel); tr.append(tdT);
    const tdM = document.createElement('td');
    const memo = document.createElement('input');
    memo.value = it.row.note; memo.placeholder = '任意'; memo.setAttribute('aria-label', '備考');
    memo.addEventListener('input', () => { it.row.note = memo.value; });
    tdM.append(memo); tr.append(tdM);
    const tdN = document.createElement('td'); tdN.className = 'newname'; tdN.dataset.i = i; tr.append(tdN);
    const tdX = document.createElement('td');
    const rm = document.createElement('button'); rm.className = 'btn'; rm.textContent = '削除'; rm.type = 'button';
    rm.addEventListener('click', () => { items.splice(i, 1); render(); });
    tdX.append(rm); tr.append(tdX);
    tbody.append(tr);
  });
  update();
}

function update() {
  const ns = names();
  document.querySelectorAll('.newname').forEach((td) => {
    const i = Number(td.dataset.i);
    const errs = validateRow(items[i].row);
    td.replaceChildren();
    if (ns[i]) td.textContent = ns[i];
    else if (items[i].row.date || items[i].row.partner || items[i].row.amount) {
      for (const e of errs) { const d = document.createElement('div'); d.className = 'err'; d.textContent = e; td.append(d); }
    }
  });
  const ok = items.length > 0 && ns.every((n) => n !== null);
  $('dl').disabled = !ok;
  $('status').textContent = items.length ? `${ns.filter(Boolean).length} / ${items.length} 件 入力済み` : '';
}

async function download() {
  const total = items.reduce((a, it) => a + it.file.size, 0);
  if (total > MAX_TOTAL) { $('status').textContent = '合計200MBを超えるため、分割して処理してください。'; return; }
  $('dl').disabled = true; $('status').textContent = '作成中…';
  try {
    const ns = names();
    const files = [];
    for (let i = 0; i < items.length; i++) {
      files.push({ name: ns[i], data: new Uint8Array(await items[i].file.arrayBuffer()) });
    }
    const csv = buildLedgerCsv(items.map((it, i) => ({ ...it.row, newName: ns[i], originalName: it.file.name })));
    files.push({ name: '検索台帳.csv', data: new TextEncoder().encode(csv) });
    const zip = buildZip(files);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
    const t = new Date();
    const ymd = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`;
    a.download = `denshi_torihiki_${ymd}.zip`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    $('status').textContent = 'ダウンロードしました。';
  } catch (e) {
    $('status').textContent = '失敗しました（フォルダは未対応です。ファイル単体で追加してください）: ' + e.message;
  } finally { update(); }
}

const drop = $('drop');
$('picker').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
$('dl').addEventListener('click', download);
$('clear').addEventListener('click', () => { items.length = 0; render(); });
