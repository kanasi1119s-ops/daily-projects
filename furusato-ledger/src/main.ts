import { Donation, summarize, deadlines, todos, warnings, toCSV, parseImport, sanitizeAmount, type Method } from './logic';

const KEY = 'furusato-ledger:v1';
const LIMIT_KEY = 'furusato-ledger:limit';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const yen = (n: number) => n.toLocaleString('ja-JP') + '円';
const today = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

function load(): Donation[] {
  try { return parseImport(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); localStorage.setItem(LIMIT_KEY, String(limit)); } catch { /* 保存不可環境 */ }
}
let data: Donation[] = load();
let limit = (() => { try { return sanitizeAmount(localStorage.getItem(LIMIT_KEY)); } catch { return 0; } })();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', attrs: Record<string, string> = {}) {
  const e = document.createElement(tag);
  e.textContent = text;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function render() {
  const s = summarize(data, limit);
  const dl = deadlines(today());
  const dls = $('deadlines'); dls.replaceChildren();
  const card = (title: string, big: string, small: string) => {
    const c = el('div', '', { class: 'card' });
    c.append(el('span', title), el('b', big), el('small', small));
    dls.append(c);
  };
  card('年内決済の期限', dl.daysToPayment >= 0 ? `あと${dl.daysToPayment}日` : '期限を過ぎました', dl.paymentDeadline);
  card('ワンストップ申請書の期限', dl.daysToOnestop >= 0 ? `あと${dl.daysToOnestop}日` : '期限を過ぎました', `${dl.onestopDeadline} 必着`);

  const sum = $('summary'); sum.replaceChildren();
  const line = (t: string, cls = '') => sum.append(el('p', t, cls ? { class: cls } : {}));
  line(`寄付合計：${yen(s.total)}（決済済 ${yen(s.paidTotal)} / 未決済 ${yen(s.unpaidTotal)}）`);
  if (s.limit > 0) line(s.remaining >= 0 ? `上限までの残り：${yen(s.remaining)}` : `上限超過：${yen(-s.remaining)}`, s.overLimit ? 'over' : '');
  line(`自己負担の目安：${yen(s.estimatedSelfBurden)}（上限内の場合）／ 寄付先：${s.municipalityCount}自治体`);

  const w = $('warnings'); w.replaceChildren(...warnings(data, s).map((t) => el('li', t)));

  const tbl = $('list'); tbl.replaceChildren();
  const hr = el('tr'); ['日付', '自治体', '金額', '返礼品', '方法', '決済', '証明書', 'ワンストップ送付', ''].forEach((h) => hr.append(el('th', h)));
  tbl.append(hr);
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  for (const d of sorted) {
    const tr = el('tr');
    tr.append(el('td', d.date), el('td', d.municipality), el('td', yen(d.amount)), el('td', d.item), el('td', d.method === 'onestop' ? 'ワンストップ' : '確定申告'));
    const toggle = (field: 'paid' | 'receiptReceived' | 'onestopSent', applicable = true) => {
      const td = el('td');
      if (applicable) {
        const cb = el('input', '', { type: 'checkbox', 'aria-label': `${d.municipality} ${({paid:'決済済み',receiptReceived:'受領証明書到着',onestopSent:'ワンストップ送付済み'})[field]}` }) as HTMLInputElement;
        cb.checked = d[field];
        cb.onchange = () => { d[field] = cb.checked; save(); render(); };
        td.append(cb);
      } else td.textContent = '-';
      return td;
    };
    tr.append(toggle('paid'), toggle('receiptReceived'), toggle('onestopSent', d.method === 'onestop'));
    const del = el('button', '削除', { class: 'sm', type: 'button' });
    del.onclick = () => { if (confirm(`${d.municipality} の記録を削除しますか？`)) { data = data.filter((x) => x.id !== d.id); save(); render(); } };
    const td = el('td'); td.append(del); tr.append(td);
    tbl.append(tr);
  }
  if (!data.length) { const tr = el('tr'); tr.append(el('td', 'まだ記録がありません', { colspan: '9' })); tbl.append(tr); }

  const t = todos(data);
  $('todos').replaceChildren(...(t.length ? t.map((x) => el('li', x.label)) : [el('li', data.length ? 'すべて完了しています' : '寄付を追加するとここに表示されます')]));
}

const limitInput = $<HTMLInputElement>('limit');
limitInput.value = limit ? String(limit) : '';
limitInput.oninput = () => { limit = sanitizeAmount(limitInput.value); save(); render(); };

$('f-date').setAttribute('value', today());
$<HTMLFormElement>('form').onsubmit = (e) => {
  e.preventDefault();
  const amount = sanitizeAmount($<HTMLInputElement>('f-amt').value);
  const mun = $<HTMLInputElement>('f-mun').value.trim();
  if (amount <= 0 || !mun) return alert('自治体と1円以上の金額を入力してください');
  data.push({
    id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
    date: $<HTMLInputElement>('f-date').value, municipality: mun, amount,
    item: $<HTMLInputElement>('f-item').value.trim(), method: $<HTMLSelectElement>('f-method').value as Method,
    paid: $<HTMLInputElement>('f-paid').checked, receiptReceived: false, onestopSent: false,
  });
  save(); (e.target as HTMLFormElement).reset(); $<HTMLInputElement>('f-date').value = today(); render();
};

function download(name: string, mime: string, body: string) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('csv').onclick = () => download('furusato.csv', 'text/csv;charset=utf-8', toCSV(data));
$('export').onclick = () => download('furusato-backup.json', 'application/json', JSON.stringify({ donations: data }, null, 2));
$<HTMLInputElement>('import').onchange = async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  try {
    const imported = parseImport(await f.text());
    if (confirm(`${imported.length}件を読み込み、現在の記録を置き換えますか？`)) { data = imported; save(); render(); }
  } catch (err) { alert('読み込みに失敗しました：' + (err as Error).message); }
  (e.target as HTMLInputElement).value = '';
};
render();
