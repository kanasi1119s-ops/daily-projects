import { calcInvoice, validateInvoice, RATES } from "./logic.js";

const $ = (s) => document.querySelector(s);
const form = $("#form");
const itemsEl = $("#items");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP");

function addItem(v = {}) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <input data-k="name" placeholder="品名" value="${esc(v.name)}">
    <input data-k="qty" type="number" min="0" step="any" placeholder="数量" value="${esc(v.qty ?? 1)}">
    <input data-k="unitPrice" type="number" min="0" step="any" placeholder="単価" value="${esc(v.unitPrice)}">
    <select data-k="rate"><option value="10">10%</option><option value="8">8%(※)</option></select>
    <button type="button" aria-label="削除">×</button>`;
  row.querySelector("select").value = String(v.rate ?? 10);
  row.querySelector("button").onclick = () => { row.remove(); render(); };
  itemsEl.appendChild(row);
}

function read() {
  const fd = new FormData(form);
  const items = [...itemsEl.children].map((r) => {
    const o = {};
    r.querySelectorAll("[data-k]").forEach((e) => (o[e.dataset.k] = e.value));
    return o;
  });
  return {
    issuerName: fd.get("issuerName"),
    registrationNumber: fd.get("registrationNumber"),
    recipientName: fd.get("recipientName"),
    date: fd.get("date"),
    rounding: fd.get("rounding"),
    items,
  };
}

function render() {
  const inv = read();
  const msgs = validateInvoice(inv);
  $("#messages").innerHTML = msgs.length
    ? msgs.map((m) => `<div class="msg ${m.level}">${esc(m.msg)}</div>`).join("")
    : '<div class="msg ok">必須項目のチェックを通過しました</div>';
  const items = inv.items.filter((i) => i.name?.trim());
  const calc = calcInvoice(items, inv.rounding);
  const rows = items
    .map((i) => {
      const amt = Math.round(Number(i.qty) * Number(i.unitPrice)) || 0;
      return `<tr><td>${esc(i.name)}${Number(i.rate) === 8 ? " ※" : ""}</td><td class="n">${esc(i.qty)}</td><td class="n">${yen(i.unitPrice || 0)}</td><td class="n">${i.rate}%</td><td class="n">${yen(amt)}</td></tr>`;
    })
    .join("");
  const sums = RATES.filter((r) => calc.byRate[r].subtotal > 0)
    .map((r) => `<tr><td>${r}%対象 ${r === 8 ? "(※軽減税率)" : ""}</td><td class="n">${yen(calc.byRate[r].subtotal)}</td><td class="n">消費税 ${yen(calc.byRate[r].tax)}</td></tr>`)
    .join("");
  $("#preview").innerHTML = `
    <h2>請求書</h2>
    <p>${esc(inv.recipientName)} 御中<br>取引年月日: ${esc(inv.date)}</p>
    <p>${esc(inv.issuerName)}<br>登録番号: ${esc(inv.registrationNumber)}</p>
    <table><thead><tr><th>品名</th><th>数量</th><th>単価(税抜)</th><th>税率</th><th>金額(税抜)</th></tr></thead><tbody>${rows}</tbody></table>
    <table><tbody>${sums}</tbody></table>
    <p><strong>合計(税込): ${yen(calc.total)}</strong></p>
    <p style="font-size:.8rem">※は軽減税率(8%)対象</p>`;
}

form.addEventListener("input", render);
$("#addItem").onclick = () => { addItem(); render(); };
$("#print").onclick = () => window.print();
addItem({ name: "", qty: 1, unitPrice: "", rate: 10 });
render();
