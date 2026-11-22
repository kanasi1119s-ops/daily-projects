import { checkInvoice } from "./core.js";
const $ = (id) => document.getElementById(id);
const tbody = document.querySelector("#items tbody");

function addRow(v = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td><input aria-label="品名" class="desc"></td>
  <td><input aria-label="数量" class="qty" inputmode="decimal" value="1"></td>
  <td><input aria-label="単価" class="price" inputmode="decimal"></td>
  <td><select aria-label="税率" class="rate"><option value="10">10%</option><option value="8">8%</option></select></td>
  <td><input aria-label="軽減税率の対象明示" class="reduced" type="checkbox"></td>
  <td><button type="button" class="del" aria-label="行を削除">×</button></td>`;
  tr.querySelector(".del").onclick = () => tr.remove();
  tbody.appendChild(tr);
}
$("addRow").onclick = () => addRow();
addRow();

const num = (s) => { const t = String(s ?? "").normalize("NFKC").replace(/[,\s円]/g, ""); return t === "" ? null : Number(t); };

function collect() {
  const items = [...tbody.querySelectorAll("tr")].map(tr => ({
    desc: tr.querySelector(".desc").value,
    qty: num(tr.querySelector(".qty").value),
    unitPrice: num(tr.querySelector(".price").value),
    rate: Number(tr.querySelector(".rate").value),
    reduced: tr.querySelector(".reduced").checked,
  }));
  const statedTax = {};
  const t10 = num($("tax10").value), t8 = num($("tax8").value);
  if (t10 != null) statedTax[10] = t10;
  if (t8 != null) statedTax[8] = t8;
  return {
    kind: $("kind").value, issuerName: $("issuerName").value, regNo: $("regNo").value,
    date: $("date").value, recipientName: $("recipientName").value,
    taxIncluded: $("taxIncluded").value === "true", rounding: $("rounding").value,
    items, statedTax,
  };
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
const ICON = { ok: "✔", ng: "✖", warn: "！" };

function render() {
  const r = checkInvoice(collect());
  const yen = (n) => n.toLocaleString("ja-JP") + "円";
  const rows = r.results.map(x => `<div class="row ${x.status}"><strong>${ICON[x.status]} ${esc(x.label)}</strong><br><span>${esc(x.message)}</span></div>`).join("");
  const tax = r.summary.rows.map(x => `<tr><td>${x.rate}%</td><td>${yen(x.exTax)}</td><td>${yen(x.tax)}</td><td>${yen(x.inTax)}</td></tr>`).join("");
  const el = $("report");
  el.hidden = false;
  el.innerHTML = `<h2>チェック結果</h2><p class="verdict ${r.pass ? "ok" : "ng"}">${r.pass ? "記載事項に不備は見つかりませんでした" : `要修正 ${r.ng}件`}${r.warn ? `(注意 ${r.warn}件)` : ""}</p>${rows}
  <h2>計算結果(税率ごとに1回端数処理)</h2><div class="scroll"><table><thead><tr><th>税率</th><th>税抜</th><th>消費税</th><th>税込</th></tr></thead><tbody>${tax}
  <tr><th>合計</th><td>${yen(r.summary.grand.exTax)}</td><td>${yen(r.summary.grand.tax)}</td><td>${yen(r.summary.grand.inTax)}</td></tr></tbody></table></div>`;
}
$("run").onclick = render;
$("kind").onchange = () => { $("recipientLabel").hidden = $("kind").value === "simplified"; };
