import { validate, hasErrors, buildDocument, summarize } from './logic.js';

const form = document.getElementById('form');
const issuesEl = document.getElementById('issues');
const preview = document.getElementById('preview');
const statusEl = document.getElementById('status');

const read = () => Object.fromEntries(new FormData(form).entries());

function render() {
  const data = read();
  document.getElementById('inspectionDateRow').hidden = data.inspection !== 'yes';
  document.getElementById('pmDetailRow').hidden = data.paymentMethod !== 'other';
  document.getElementById('origRow').hidden = data.resubcontract !== 'yes';
  const issues = validate(data);
  issuesEl.replaceChildren();
  if (issues.length === 0) {
    const li = document.createElement('li');
    li.className = 'ok';
    li.textContent = '入力済み項目に不足は見つかりませんでした（最終確認は一次情報で）。';
    issuesEl.append(li);
  }
  if (issues.length) {
    const { errors, warns } = summarize(issues);
    const h = document.createElement('li');
    h.style.listStyle = 'none';
    h.style.fontWeight = '700';
    h.textContent = `要修正 ${errors}件 / 確認 ${warns}件`;
    issuesEl.append(h);
  }
  for (const i of issues) {
    const li = document.createElement('li');
    li.className = i.level;
    li.textContent = (i.level === 'error' ? '【要修正】' : '【確認】') + i.message;
    issuesEl.append(li);
  }
  preview.textContent = buildDocument(data);
  return issues;
}

form.addEventListener('input', render);
form.addEventListener('change', render);
document.getElementById('copy').addEventListener('click', async () => {
  const issues = render();
  try {
    await navigator.clipboard.writeText(preview.textContent);
    statusEl.textContent = hasErrors(issues) ? 'コピーしました（未解決の【要修正】があります）。' : 'コピーしました。';
  } catch { statusEl.textContent = 'コピーに失敗しました。プレビューを手動で選択してください。'; }
});
document.getElementById('print').addEventListener('click', () => { render(); window.print(); });
document.getElementById('reset').addEventListener('click', () => { form.reset(); render(); statusEl.textContent = 'クリアしました。'; });
render();
