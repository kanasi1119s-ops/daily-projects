import { validateSpec, renderSpec, checkPaymentDate, paymentDeadline, PROHIBITED, evaluateProhibited, parseDate } from './logic.js';

const $ = (s) => document.querySelector(s);

function msg(container, items, cls) {
  for (const t of items) {
    const d = document.createElement('div');
    d.className = `msg ${cls}`;
    d.textContent = t; // textContent: XSS対策
    container.appendChild(d);
  }
}

// --- タブ ---
const tabs = ['spec', 'pay', 'ng'];
for (const t of tabs) {
  $(`#tab-${t}`).addEventListener('click', () => {
    for (const u of tabs) {
      $(`#tab-${u}`).setAttribute('aria-selected', String(u === t));
      $(`#panel-${u}`).hidden = u !== t;
    }
  });
}

// --- ① 明示書 ---
const form = $('#spec-form');
const getForm = () => Object.fromEntries(new FormData(form).entries());
let lastText = '';

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = getForm();
  const box = $('#spec-messages');
  box.replaceChildren();
  const { errors, warnings } = validateSpec(f);
  msg(box, errors, 'error');
  msg(box, warnings, 'warn');
  if (errors.length) { $('#spec-result').hidden = true; return; }
  lastText = renderSpec(f);
  $('#spec-output').textContent = lastText;
  $('#spec-result').hidden = false;
});

$('#btn-copy').addEventListener('click', async () => {
  const box = $('#spec-messages');
  try { await navigator.clipboard.writeText(lastText); msg(box, ['コピーしました'], 'ok'); }
  catch { msg(box, ['コピーに失敗しました。テキストを選択して手動でコピーしてください'], 'warn'); }
});
$('#btn-download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([lastText], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `meiji-sho_${$('[name=orderDate]').value || 'draft'}.txt`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#btn-print').addEventListener('click', () => window.print());
$('#btn-reset').addEventListener('click', () => {
  form.reset();
  $('#spec-messages').replaceChildren();
  $('#spec-result').hidden = true;
});
$('#btn-sample').addEventListener('click', () => {
  const s = {
    clientName: '株式会社サンプル商事', clientContact: 'info@example.com', freelancerName: '山田 太郎', freelancerContact: '',
    orderDate: '2026-12-01', deliveryDate: '2026-12-20', deliveryPlace: 'オンライン納品', inspectionDate: '',
    workDescription: 'バナー画像3点の制作(仕様は別紙のとおり)', reward: '150000', taxNote: '消費税込', rewardCalc: '',
    payDate: '2027-01-31', payMethod: '銀行振込', payMethodNote: '', feeBearer: 'client',
  };
  for (const [k, v] of Object.entries(s)) { if (form.elements[k]) form.elements[k].value = v; }
});

// --- ② 支払期日 ---
function updatePay() {
  const r = $('#pay-receipt').value, p = $('#pay-planned').value;
  const box = $('#pay-result');
  box.replaceChildren();
  if (!r) return;
  const dl = paymentDeadline(r);
  if (!dl) { msg(box, ['受領日の形式が不正です'], 'error'); return; }
  msg(box, [`支払期日の上限(60日以内): ${dl}`], 'ok');
  if (p) {
    const c = checkPaymentDate(r, p);
    if (!c.valid) msg(box, ['支払日の形式が不正です'], 'error');
    else if (c.ok) msg(box, ['予定の支払日は60日以内です'], 'ok');
    else msg(box, [`予定の支払日は上限を${c.overDays}日超過しています。${dl}までに前倒しが必要です`], 'error');
  }
}
$('#pay-receipt').addEventListener('input', updatePay);
$('#pay-planned').addEventListener('input', updatePay);

// --- ③ 禁止行為 ---
const ngList = $('#ng-list');
for (const p of PROHIBITED) {
  const l = document.createElement('label');
  l.className = 'ng-item';
  const c = document.createElement('input');
  c.type = 'checkbox'; c.id = `ng-${p.id}`; c.dataset.id = p.id;
  const s = document.createElement('span');
  s.textContent = p.q;
  l.append(c, s);
  ngList.appendChild(l);
}
function updateNg() {
  const answers = {};
  ngList.querySelectorAll('input').forEach((i) => { answers[i.dataset.id] = i.checked; });
  const { applicable, hits } = evaluateProhibited(answers, Number($('#ng-months').value));
  const box = $('#ng-result');
  box.replaceChildren();
  if (!applicable) { msg(box, ['委託期間が1か月未満の場合、フリーランス法の禁止行為規定は適用されませんが、取引条件の明示・60日ルールは適用されます'], 'warn'); return; }
  if (!hits.length) msg(box, ['チェックされた項目はありません(これだけで適法と保証するものではありません)'], 'ok');
  else msg(box, hits.map((h) => `${h.note}に抵触するおそれがあります。契約・運用の見直しと専門家への相談を検討してください`), 'error');
}
ngList.addEventListener('change', updateNg);
$('#ng-months').addEventListener('change', updateNg);
