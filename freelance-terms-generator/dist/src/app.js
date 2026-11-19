import { validate, generateDocument, paymentDeadline, formatDate, parseDate } from './terms.js';

const form = document.getElementById('f');
const out = document.getElementById('out');
const msgs = document.getElementById('msgs');
const copyBtn = document.getElementById('copy');
const printBtn = document.getElementById('print');

const data = () => Object.fromEntries(new FormData(form).entries());

function render(list, cls) {
  for (const m of list) {
    const li = document.createElement('li');
    li.className = cls;
    li.textContent = m; // textContent: XSS対策
    msgs.append(li);
  }
}

function updateHints() {
  const d = data();
  document.getElementById('insRow').hidden = d.inspection !== 'yes';
  const dl = paymentDeadline(d.deliveryDate);
  document.getElementById('hint').textContent = dl ? `支払期日の上限(受領日から60日): ${formatDate(parseDate(dl))}` : '';
}
function clearOutput() { out.textContent = ''; copyBtn.disabled = printBtn.disabled = true; }
form.addEventListener('input', () => { updateHints(); clearOutput(); });
form.addEventListener('change', () => { updateHints(); clearOutput(); });

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const d = data();
  const { errors, warnings } = validate(d);
  msgs.replaceChildren();
  render(errors.map((x) => x.message), 'err');
  render(warnings, 'warn');
  for (const el of form.elements) el.removeAttribute?.('aria-invalid');
  for (const er of errors) form.elements[er.key]?.setAttribute('aria-invalid', 'true');
  if (errors.length) form.elements[errors[0].key]?.focus();
  const ok = errors.length === 0;
  out.textContent = ok ? generateDocument(d) : '';
  copyBtn.disabled = printBtn.disabled = !ok;
});

copyBtn.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(out.textContent); copyBtn.textContent = 'コピーしました'; }
  catch { copyBtn.textContent = 'コピー失敗(手動で選択してください)'; }
  setTimeout(() => (copyBtn.textContent = 'コピー'), 2000);
});
printBtn.addEventListener('click', () => window.print());
updateHints();
