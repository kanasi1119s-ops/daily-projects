import { TYPES, PRACTICES, PAYMENT_METHODS, evaluate, summarize } from './logic.js';

const $ = (id) => document.getElementById(id);
const BADGE = { ng: '要対応', warn: '要確認', ok: '問題なし' };
const APPLY = {
  yes: '取適法の適用対象となる可能性があります。',
  maybe: '資本金基準では対象外ですが、従業員数基準が未確認です。',
  no: '入力内容では取適法の適用基準に該当しません。',
  unknown: '入力が不足しています。',
};

for (const [k, v] of Object.entries(TYPES)) $('type').add(new Option(v.label, k));
for (const [k, v] of Object.entries(PAYMENT_METHODS)) $('paymentMethod').add(new Option(v.label, k));
for (const p of PRACTICES.filter((x) => !x.auto)) {
  const l = document.createElement('label');
  l.className = 'check';
  const c = document.createElement('input');
  c.type = 'checkbox'; c.value = p.id; c.name = 'practice';
  const s = document.createElement('span');
  s.textContent = p.label;
  l.append(c, s);
  $('practices').append(l);
}

function readInput() {
  const v = (id) => $(id).value;
  return {
    type: v('type'), clientCapital: v('clientCapital'), clientEmployees: v('clientEmployees'),
    contractorCapital: v('contractorCapital'), contractorEmployees: v('contractorEmployees'),
    paymentDays: v('paymentDays'), paymentMethod: v('paymentMethod'), writtenTerms: v('writtenTerms'),
    practices: [...document.querySelectorAll('input[name=practice]:checked')].map((c) => c.value),
  };
}

function render(res) {
  const a = res.applicability;
  $('applicability').textContent = `【適用判定】${APPLY[a.result]} ${a.reasons.join(' ')}`;
  const s = summarize(res);
  const note = a.result === 'no' ? '(適用対象外のため参考表示です)' : '';
  $('summary').textContent = `要対応 ${s.ng} 件 / 要確認 ${s.warn} 件 / 問題なし ${s.ok} 件${note}`;
  const ul = $('findings');
  ul.replaceChildren();
  for (const f of res.findings) {
    const li = document.createElement('li');
    li.className = f.level;
    const t = document.createElement('strong');
    const b = document.createElement('span');
    b.className = 'badge'; b.textContent = `[${BADGE[f.level]}]`;
    t.append(b, document.createTextNode(f.title));
    const d = document.createElement('span');
    d.textContent = f.detail;
    li.append(t, d);
    ul.append(li);
  }
  $('result').hidden = false;
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('form').addEventListener('submit', (e) => { e.preventDefault(); render(evaluate(readInput())); });
$('form').addEventListener('reset', () => { $('result').hidden = true; });
