import { buildOrderSheet, checkPaymentDate, diagnose, DIAGNOSIS_QUESTIONS } from "./lib/logic.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("nav button").forEach((x) => x.setAttribute("aria-selected", x === b));
  for (const id of ["sheet", "pay", "diag"]) $("#" + id).hidden = id !== b.dataset.t;
}));

$("#f").addEventListener("submit", (e) => {
  e.preventDefault();
  const r = buildOrderSheet(Object.fromEntries(new FormData(e.target)));
  $("#sheetOut").hidden = false;
  $("#txt").textContent = r.text;
  $("#miss").textContent = [r.missing.length ? "未記入の明示事項: " + r.missing.join("、") : "", ...r.warnings].filter(Boolean).join(" / ");
  $("#copy").textContent = "コピー";
});
$("#copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("#txt").textContent); $("#copy").textContent = "コピーしました"; }
  catch { $("#copy").textContent = "コピーに失敗(手動で選択してください)"; }
});

$("#calc").addEventListener("click", () => {
  const r = checkPaymentDate($("#rd").value, $("#pd").value);
  $("#payOut").innerHTML = r.ok
    ? `<span class="ok">上限(${esc(r.limit)})以内です。</span>`
    : `<span class="ng">${esc(r.reason)}</span>` + (r.limit ? ` 上限日: ${esc(r.limit)}` : "");
});

$("#df").innerHTML = DIAGNOSIS_QUESTIONS.map((q) =>
  `<fieldset><legend>${esc(q.text)}</legend><label><input type="radio" name="${q.id}" value="1" style="width:auto"> はい</label><label><input type="radio" name="${q.id}" value="0" style="width:auto"> いいえ</label></fieldset>`).join("");
$("#run").addEventListener("click", () => {
  const fd = new FormData($("#df")), a = {};
  for (const q of DIAGNOSIS_QUESTIONS) { const v = fd.get(q.id); if (v !== null) a[q.id] = v === "1"; }
  const r = diagnose(a);
  $("#dOut").innerHTML = `<h2>${esc(r.level)}</h2>` +
    (r.issues.length ? "<h3 class='ng'>見直し候補</h3><ul>" + r.issues.map((q) => `<li>${esc(q.text)}<br><small>${esc(q.tip)}</small></li>`).join("") + "</ul>" : "") +
    (r.unknown.length ? `<p>未回答 ${r.unknown.length} 件</p>` : "");
});

const toggle = () => {
  const f = $("#f");
  f.inspectionDate.closest("label").hidden = f.inspection.value !== "yes";
  f.nonCashMethod.closest("label").hidden = f.nonCash.value !== "yes";
};
$("#f").addEventListener("change", toggle); toggle();
