import { emptyForm, OrderForm, validate, render, prohibitedChecklist } from './logic';

const KEY = 'freelance-order-sheet:v1';
const fields: { k: keyof OrderForm; label: string; type: 'text' | 'date' | 'area' | 'select'; opt?: boolean }[] = [
  { k: 'clientName', label: '発注事業者の名称', type: 'text' },
  { k: 'freelancerName', label: 'フリーランスの名称', type: 'text' },
  { k: 'orderDate', label: '業務委託をした日', type: 'date' },
  { k: 'description', label: '業務の内容', type: 'area' },
  { k: 'deliveryDate', label: '納品(提供)日', type: 'date' },
  { k: 'deliveryPlace', label: '納品(提供)場所', type: 'text' },
  { k: 'inspectionDate', label: '検査完了日', type: 'date', opt: true },
  { k: 'amount', label: '報酬額(円)', type: 'text', opt: true },
  { k: 'taxMode', label: '税込/税別', type: 'select', opt: true },
  { k: 'amountNote', label: '報酬の算定方法など', type: 'text', opt: true },
  { k: 'dueDate', label: '報酬の支払期日', type: 'date' },
  { k: 'payMethod', label: '支払方法(現金払以外の場合)', type: 'text', opt: true },
];

function load(): OrderForm {
  const out: OrderForm = { ...emptyForm };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (raw && typeof raw === 'object') {
      for (const k of Object.keys(emptyForm) as (keyof OrderForm)[]) {
        if (typeof raw[k] === 'string') (out as unknown as Record<string, string>)[k] = raw[k];
      }
    }
  } catch { /* ignore corrupt storage */ }
  if (out.taxMode !== '税込' && out.taxMode !== '税別') out.taxMode = '';
  return out;
}
function save(f: OrderForm) { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* ignore */ } }

let state = load();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = $('f');

for (const fd of fields) {
  const l = document.createElement('label');
  l.htmlFor = 'in-' + fd.k;
  l.append(fd.label);
  if (fd.opt) { const s = document.createElement('span'); s.className = 'opt'; s.textContent = ' (任意)'; l.append(s); }
  const el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement = fd.type === 'area' ? document.createElement('textarea') : fd.type === 'select' ? document.createElement('select') : document.createElement('input');
  if (el instanceof HTMLSelectElement) for (const v of ['', '税込', '税別']) el.append(new Option(v || '(未選択)', v));
  el.id = 'in-' + fd.k;
  if (el instanceof HTMLInputElement) el.type = fd.type === 'date' ? 'date' : 'text';
  el.addEventListener('input', () => { state = { ...state, [fd.k]: el.value } as OrderForm; save(state); update(); });
  form.append(l, el);
}
const chk = $('chk');
for (const c of prohibitedChecklist) {
  const l = document.createElement('label'); const i = document.createElement('input'); i.type = 'checkbox';
  l.append(i, ' ' + c); chk.append(l);
}

function sync() { for (const fd of fields) ($('in-' + fd.k) as HTMLInputElement).value = state[fd.k] ?? ''; }
function update() {
  const ul = $('issues'); ul.replaceChildren();
  const issues = validate(state);
  if (!issues.length) { const li = document.createElement('li'); li.textContent = '✓ 明示事項の入力に不備は見つかりません'; ul.append(li); }
  for (const i of issues) { const li = document.createElement('li'); li.className = i.level; li.textContent = (i.level === 'error' ? '✗ ' : '! ') + i.message; ul.append(li); }
  $('out').textContent = render(state);
}
$('sample').onclick = () => {
  state = { ...emptyForm, clientName: '株式会社サンプル', freelancerName: 'サンプル 太郎', orderDate: '2026-11-01',
    description: 'Webサイトのバナー画像5点の制作', deliveryDate: '2026-11-30', deliveryPlace: 'メールにて電子データで納品',
    amount: '150000', taxMode: '税込', dueDate: '2026-12-31', payMethod: '銀行振込' };
  save(state); sync(); update();
};
$('clear').onclick = () => { state = { ...emptyForm }; save(state); sync(); update(); };
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('out').textContent || ''); $('msg').textContent = 'コピーしました'; }
  catch { $('msg').textContent = 'コピーできませんでした。プレビューを手動で選択してください'; }
};
$('print').onclick = () => window.print();
sync(); update();
