import {
  CYCLES, CATEGORIES, totals, byCategory, upcoming, nextPayment, monthlyCost, yearlyCost,
  validate, newId, sanitize, buildIcs, toCsv, importCsv, fmtYmd,
} from './lib.js';

const KEY = 'sub-keeper:v1';
const $ = (id) => document.getElementById(id);
const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
const todayStr = () => {
  const d = new Date(); // ローカル日付を採用
  return fmtYmd(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
};

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return sanitize(v);
  } catch { return []; }
}
let subs = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(subs)); } catch { $('io-msg').textContent = '保存に失敗しました（ストレージ容量/プライベートモードをご確認ください）'; }
}

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function render() {
  const today = todayStr();
  const t = totals(subs);
  $('t-month').textContent = yen(t.monthly);
  $('t-year').textContent = yen(t.yearly);
  $('t-count').textContent = String(t.count);

  const up = $('upcoming'); up.replaceChildren();
  const items = upcoming(subs, today, 30);
  if (!items.length) up.append(el('li', '30日以内の支払いはありません'));
  for (const { sub, date, days } of items) {
    const li = el('li');
    li.append(el('span', `${sub.name}　${yen(sub.amount)}`));
    li.append(el('span', `${date}（${days === 0 ? '今日' : days + '日後'}）`, days <= 3 ? 'soon' : 'sub'));
    up.append(li);
  }

  const cats = $('cats'); cats.replaceChildren();
  const bc = byCategory(subs);
  const max = Math.max(1, ...bc.map((c) => c.monthly));
  for (const c of bc) {
    const row = el('div', null, 'cat');
    const bar = el('div', null, 'bar'); bar.style.width = `${(c.monthly / max) * 100}%`;
    row.append(el('span', c.category), bar, el('b', yen(c.monthly)));
    cats.append(row);
  }

  const all = $('all'); all.replaceChildren();
  if (!subs.length) all.append(el('li', 'まだ登録がありません。上のフォームから追加してください。'));
  for (const s of subs) {
    const li = el('li', null, s.active === false ? 'off' : '');
    const left = el('div');
    left.append(el('div', `${s.name}（${s.category}）`));
    left.append(el('div', `${yen(s.amount)} / ${CYCLES[s.cycle]?.label ?? s.cycle}・月額換算 ${yen(monthlyCost(s))}・年額換算 ${yen(yearlyCost(s))}・次回 ${nextPayment(s, today) ?? '-'}${s.note ? '・' + s.note : ''}`, 'sub'));
    const right = el('div', null, 'row');
    const mk = (label, fn, cls) => { const b = el('button', label, cls); b.type = 'button'; b.addEventListener('click', fn); return b; };
    right.append(
      mk('編集', () => startEdit(s.id), 'sec'),
      mk(s.active === false ? '再開' : '停止中にする', () => { s.active = s.active === false; save(); render(); }, 'sec'),
      mk('削除', () => { if (confirm(`「${s.name}」を削除しますか？`)) { subs = subs.filter((x) => x.id !== s.id); save(); render(); } }, 'danger'),
    );
    li.append(left, right);
    all.append(li);
  }
}

function fillSelects() {
  for (const [k, v] of Object.entries(CYCLES)) $('f-cycle').append(new Option(v.label, k));
  $('f-cycle').value = 'monthly';
  for (const c of CATEGORIES) $('f-cat').append(new Option(c, c));
  $('f-cat').value = 'その他';
  $('f-date').value = todayStr();
}

function resetForm() {
  $('form').reset();
  $('f-id').value = '';
  $('f-date').value = todayStr();
  $('form-title').textContent = 'サブスクを追加';
  $('f-submit').textContent = '追加';
  $('f-cancel').hidden = true;
  $('f-err').textContent = '';
}

function startEdit(id) {
  const s = subs.find((x) => x.id === id);
  if (!s) return;
  $('f-id').value = s.id; $('f-name').value = s.name; $('f-amount').value = s.amount;
  $('f-cycle').value = s.cycle; $('f-date').value = s.nextDate; $('f-cat').value = s.category; $('f-note').value = s.note || '';
  $('form-title').textContent = 'サブスクを編集';
  $('f-submit').textContent = '更新';
  $('f-cancel').hidden = false;
  $('form').scrollIntoView({ behavior: 'smooth' });
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    name: $('f-name').value.trim(), amount: Number($('f-amount').value), cycle: $('f-cycle').value,
    nextDate: $('f-date').value, category: $('f-cat').value, note: $('f-note').value.trim(),
  };
  const errs = validate(data);
  if (errs.length) { $('f-err').textContent = errs.join(' / '); return; }
  const id = $('f-id').value;
  if (id) subs = subs.map((s) => (s.id === id ? { ...s, ...data } : s));
  else subs.push({ id: newId(), active: true, ...data });
  save(); resetForm(); render();
});
$('f-cancel').addEventListener('click', resetForm);

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('b-ics').addEventListener('click', () => download('sub-keeper.ics', buildIcs(subs, todayStr(), 3), 'text/calendar'));
$('b-csv').addEventListener('click', () => download('sub-keeper.csv', '﻿' + toCsv(subs), 'text/csv'));
$('b-pick').addEventListener('click', () => $('b-import').click());
$('b-import').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 1_000_000) { $('io-msg').textContent = 'ファイルが大きすぎます（上限1MB）'; return; }
  const r = importCsv(await f.text());
  if (r.error) { $('io-msg').textContent = r.error; }
  else { subs = subs.concat(r.subs); save(); render(); $('io-msg').textContent = `${r.subs.length}件を追加、${r.skipped}件をスキップしました`; }
  e.target.value = '';
});
$('b-clear').addEventListener('click', () => {
  if (confirm('登録データをすべて削除します。よろしいですか？')) { subs = []; save(); render(); }
});

fillSelects();
render();
