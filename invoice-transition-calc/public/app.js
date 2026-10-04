import { SCHEDULE, calcLine, summarize } from './calc.js';

const yen = (n) => n.toLocaleString('ja-JP');
const $ = (id) => document.getElementById(id);
const rowsBody = $('rowsBody');

for (const s of SCHEDULE) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${s.from.replaceAll('-', '/')} 〜 ${s.to.replaceAll('-', '/')}</td><td>${s.pct}%</td>`;
  $('schedBody').append(tr);
}
const tr0 = document.createElement('tr');
tr0.innerHTML = '<td>2031/10/01 以降</td><td>0%(控除なし)</td>';
$('schedBody').append(tr0);

function addRow(v = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="memo" maxlength="40" aria-label="摘要"></td>
    <td><input type="date" class="date" aria-label="仕入日"></td>
    <td><input type="number" class="amount" min="0" step="1" aria-label="金額"></td>
    <td><select class="incl" aria-label="金額区分"><option value="1">税込</option><option value="0">税抜</option></select></td>
    <td><select class="rate" aria-label="税率"><option>10</option><option>8</option></select></td>
    <td><select class="sup" aria-label="仕入先"><option value="unregistered">未登録</option><option value="qualified">適格請求書発行事業者</option></select></td>
    <td class="n pct"></td><td class="n tax"></td><td class="n ded"></td><td class="n non"></td>
    <td><button type="button" class="del" aria-label="行を削除">削除</button></td>`;
  tr.querySelector('.memo').value = v.memo ?? '';
  tr.querySelector('.date').value = v.date ?? '2026-10-01';
  tr.querySelector('.amount').value = v.amount ?? 110000;
  tr.querySelectorAll('input,select').forEach((el) => el.addEventListener('input', render));
  tr.querySelector('.del').addEventListener('click', () => { tr.remove(); render(); });
  rowsBody.append(tr);
  render();
}

function render() {
  const results = [];
  const errs = [];
  [...rowsBody.rows].forEach((tr, i) => {
    const q = (c) => tr.querySelector(c);
    const cells = ['.pct', '.tax', '.ded', '.non'].map(q);
    try {
      const raw = q('.amount').value;
      const r = calcLine({
        amount: raw === '' ? NaN : Number(raw),
        taxIncluded: q('.incl').value === '1',
        taxRate: Number(q('.rate').value),
        date: q('.date').value,
        supplier: q('.sup').value,
        rounding: $('rounding').value,
      });
      results.push(r);
      cells[0].textContent = `${r.pct}%`;
      cells[1].textContent = yen(r.tax);
      cells[2].textContent = yen(r.deductible);
      cells[3].textContent = yen(r.nonDeductible);
      cells[0].title = r.note;
    } catch (e) {
      cells.forEach((c) => { c.textContent = '—'; });
      errs.push(`${i + 1}行目: ${e.message}`);
    }
  });
  const s = summarize(results);
  $('tTax').textContent = yen(s.tax);
  $('tDed').textContent = yen(s.deductible);
  $('tNon').textContent = yen(s.nonDeductible);
  $('err').textContent = errs.join(' / ');
}

$('add').addEventListener('click', () => addRow());
$('rounding').addEventListener('input', render);
addRow({ memo: '外注費(例)' });
