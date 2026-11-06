import { CATEGORIES, CYCLES, importJSON, monthlyCost, nextRenewal, summarize, todayString, toCSV, toICS, validateItem, daysBetween } from './core.js';

const KEY = 'subscription-audit:v1';
const $ = (id) => document.getElementById(id);
let items = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? uniqueIds(importJSON(raw).items) : [];
  } catch { return []; }
}
// id欠落・重複があっても編集/削除が他の行に波及しないよう、読み込み時に採番し直す
function uniqueIds(list) {
  const seen = new Set();
  return list.map((x) => {
    const id = x.id && !seen.has(x.id) ? x.id : newId();
    seen.add(id);
    return { ...x, id };
  });
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
  catch { status('保存できませんでした(ブラウザの設定でストレージが無効かもしれません)。JSONバックアップをご利用ください。'); return false; }
}
const yen = (n) => Math.round(n).toLocaleString('ja-JP') + '円';
function newId() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2, 8); }
function status(msg) { $('status').textContent = msg; }

function el(tag, text, cls) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }

function render() {
  const today = todayString();
  const s = summarize(items, today);
  const cards = $('summary'); cards.replaceChildren();
  for (const [v, l] of [[yen(s.monthly), '月額の合計(換算)'], [yen(s.yearly), '年額の合計(換算)'], [String(items.length) + '件', '登録数']]) {
    const c = el('div', null, 'card'); c.append(el('b', v), el('span', l)); cards.append(c);
  }
  const up = $('upcoming'); up.replaceChildren();
  if (s.upcoming.length) {
    const d = el('div', null, 'note');
    d.append(el('strong', '30日以内に更新されるもの: '),
      document.createTextNode(s.upcoming.map((u) => `${u.item.name}(${u.next}・${u.days === 0 ? '本日' : u.days + '日後'})`).join('、')));
    up.append(d);
  }
  const cd = $('candidates'); cd.replaceChildren();
  if (s.candidates.length) {
    const d = el('div', null, 'note');
    d.append(el('strong', '見直し候補(利用頻度が低い): '),
      document.createTextNode(`${s.candidates.map((c) => c.name).join('、')}。すべて解約した場合の年額は${yen(s.potentialYearlySaving)}分です(目安であり、節約を保証するものではありません)。`));
    cd.append(d);
  }
  const rows = $('rows'); rows.replaceChildren();
  const sorted = items.map((it) => ({ it, next: nextRenewal(it, today) })).sort((a, b) => (a.next < b.next ? -1 : a.next > b.next ? 1 : 0));
  for (const { it, next } of sorted) {
    const tr = document.createElement('tr');
    const name = el('td', it.name); if (it.memo) { name.append(document.createElement('br'), el('small', it.memo)); }
    const days = daysBetween(today, next);
    tr.append(name, el('td', `${yen(it.amount)} / ${CYCLES[it.cycle].label}`), el('td', yen(monthlyCost(it))),
      el('td', `${next}(${days === 0 ? '本日' : days + '日後'})`), el('td', `${it.usage} / 5`));
    const act = document.createElement('td');
    const e = el('button', '編集'); e.type = 'button'; e.addEventListener('click', () => edit(it.id));
    const d = el('button', '削除'); d.type = 'button'; d.addEventListener('click', () => { items = items.filter((x) => x.id !== it.id); save(); render(); status(`「${it.name}」を削除しました`); });
    act.append(e, d); tr.append(act); rows.append(tr);
  }
  $('empty').hidden = items.length > 0;
  document.querySelector('table').hidden = items.length === 0;
}

function resetForm() {
  $('form').reset(); $('f-id').value = ''; $('f-submit').textContent = '追加'; $('f-cancel').hidden = true; $('form-error').textContent = '';
}
function edit(id) {
  const it = items.find((x) => x.id === id); if (!it) return;
  $('f-id').value = it.id; $('f-name').value = it.name; $('f-amount').value = it.amount; $('f-cycle').value = it.cycle;
  $('f-date').value = it.billingDate; $('f-usage').value = String(it.usage); $('f-category').value = it.category; $('f-memo').value = it.memo;
  $('f-submit').textContent = '更新'; $('f-cancel').hidden = false; $('f-name').focus();
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function init() {
  for (const c of CATEGORIES) { const o = el('option', c); o.value = c; $('f-category').append(o); }
  $('f-date').value = todayString();
  $('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = validateItem({
      id: $('f-id').value, name: $('f-name').value, amount: $('f-amount').value, cycle: $('f-cycle').value,
      billingDate: $('f-date').value, usage: $('f-usage').value, category: $('f-category').value, memo: $('f-memo').value,
    });
    if (!v.ok) { $('form-error').textContent = v.errors.join(' / '); return; }
    const editing = $('f-id').value && items.some((x) => x.id === $('f-id').value);
    if (editing) items = items.map((x) => (x.id === $('f-id').value ? { ...v.item, id: x.id } : x));
    else items.push({ ...v.item, id: newId() });
    save(); resetForm(); $('f-date').value = todayString(); render(); status(editing ? '更新しました' : '追加しました');
  });
  $('f-cancel').addEventListener('click', () => { resetForm(); $('f-date').value = todayString(); });
  $('b-sample').addEventListener('click', () => {
    const t = todayString();
    const mk = (name, amount, cycle, usage, category, memo = '') => ({ id: newId(), name, amount, cycle, billingDate: t, usage, category, memo });
    items.push(mk('(例)動画配信A', 1490, 'monthly', 4, '動画・音楽'), mk('(例)クラウド保存B', 12000, 'yearly', 2, 'クラウド・保存', '年払い'), mk('(例)学習アプリC', 980, 'monthly', 1, '学習'));
    save(); render(); status('サンプルを追加しました(削除ボタンで消せます)');
  });
  $('b-ics').addEventListener('click', () => { if (!items.length) return status('登録がありません'); download('subscriptions.ics', toICS(items, todayString()), 'text/calendar;charset=utf-8'); status('カレンダー用ファイルを書き出しました。お使いのカレンダーアプリで読み込んでください'); });
  $('b-csv').addEventListener('click', () => { if (!items.length) return status('登録がありません'); download('subscriptions.csv', toCSV(items, todayString()), 'text/csv;charset=utf-8'); });
  $('b-json').addEventListener('click', () => { if (!items.length) return status('登録がありません'); download('subscriptions-backup.json', JSON.stringify({ items }, null, 2), 'application/json'); });
  $('b-import').addEventListener('change', async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    if (f.size > 2_000_000) { status('ファイルが大きすぎます'); return; }
    const r = importJSON(await f.text());
    ev.target.value = '';
    if (r.error) return status(r.error);
    const sig = (x) => [x.name, x.amount, x.cycle, x.billingDate].join('|');
    const have = new Set(items.map(sig));
    const fresh = r.items.filter((x) => !have.has(sig(x)));
    items = items.concat(fresh.map((x) => ({ ...x, id: newId() }))); save(); render();
    status(`${fresh.length}件を読み込みました${r.items.length - fresh.length ? `(重複${r.items.length - fresh.length}件は除外)` : ''}${r.skipped ? `(不正な${r.skipped}件はスキップ)` : ''}`);
  });
  $('b-clear').addEventListener('click', () => {
    if (!items.length) return;
    if (!confirm('登録した全データを削除します。よろしいですか?(元に戻せません)')) return;
    items = []; save(); render(); status('全データを削除しました');
  });
  render();
}
init();
