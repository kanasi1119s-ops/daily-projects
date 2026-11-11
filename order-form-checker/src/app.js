import { FIELDS, check, generateText } from './checker.js';

const $ = id => document.getElementById(id);
const ids = [...FIELDS.map(f => f.key), 'taxIncluded'];
const LABEL = { ok: '✓ OK', missing: '✗ 未記入', invalid: '✗ 不正', warn: '△ 要確認', optional: '– 任意' };

function read() { return Object.fromEntries(ids.map(k => [k, $(k).value])); }

function render() {
  const form = read();
  const r = check(form);
  $('summary').textContent = `エラー ${r.errors} 件 / 要確認 ${r.warnings} 件`;
  const ul = $('results');
  ul.replaceChildren();
  for (const it of r.items) {
    const li = document.createElement('li');
    li.className = it.status;
    li.textContent = `${LABEL[it.status]}　${it.label}${it.message ? '：' + it.message : ''}`;
    ul.appendChild(li);
  }
  $('out').textContent = generateText(form);
}

$('f').addEventListener('input', render);
$('f').addEventListener('submit', e => e.preventDefault());
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('out').textContent); $('copy').textContent = 'コピーしました'; }
  catch { $('copy').textContent = 'コピー失敗：手動で選択してください'; }
  setTimeout(() => { $('copy').textContent = 'コピー'; }, 2000);
});
render();
