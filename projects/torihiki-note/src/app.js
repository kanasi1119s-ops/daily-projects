import { validate } from './validate.js';
import { buildDocument, PROHIBITED_ACTS } from './render.js';

const form = document.getElementById('form');
const result = document.getElementById('result');
const doc = document.getElementById('doc');
const copyBtn = document.getElementById('copy');
const printBtn = document.getElementById('print');
const copyStatus = document.getElementById('copyStatus');

export function readForm() {
  const f = form.elements;
  const data = {};
  for (const el of f) {
    if (!el.name) continue;
    data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return data;
}

function addMsg(cls, text) {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  result.appendChild(div);
}

let touched = false;

function render() {
  const data = readForm();
  document.getElementById('inspectionDateRow').hidden = !data.inspection;
  document.getElementById('cashlessRow').hidden = !data.cashless;
  const r = validate(data);
  result.replaceChildren();
  if (!touched) {
    addMsg('info', '左のフォームに入力すると、明示事項の漏れと支払期日(60日ルール)をここに表示します。');
    doc.textContent = '必須項目をすべて正しく入力すると、ここに通知書が表示されます。';
    copyBtn.disabled = true;
    printBtn.disabled = true;
    return;
  }
  r.errors.forEach((m) => addMsg('err', m));
  r.warnings.forEach((m) => addMsg('warn', m));
  r.infos.forEach((m) => addMsg('info', m));
  if (r.payDays !== null && r.errors.length === 0) addMsg('ok', `必須項目に漏れはありません。支払期日は受領日から${r.payDays}日後です。`);
  const ok = r.errors.length === 0;
  doc.textContent = ok ? buildDocument(data) : '必須項目をすべて正しく入力すると、ここに通知書が表示されます。';
  copyBtn.disabled = !ok;
  printBtn.disabled = !ok;
  copyStatus.textContent = '';
}

const onEdit = () => { touched = true; render(); };
form.addEventListener('input', onEdit);
form.addEventListener('change', onEdit);
form.addEventListener('submit', (e) => e.preventDefault());

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(doc.textContent);
    copyStatus.textContent = 'コピーしました';
  } catch {
    copyStatus.textContent = 'コピーできませんでした。テキストを選択して手動でコピーしてください。';
  }
});
printBtn.addEventListener('click', () => window.print());

const acts = document.getElementById('acts');
PROHIBITED_ACTS.forEach((t) => {
  const li = document.createElement('li');
  li.textContent = t;
  acts.appendChild(li);
});

render();
