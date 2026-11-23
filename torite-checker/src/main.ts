import { parseDate, fmt, checkPayment, closingWorstCase, judgeApplicability } from "./logic";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const num = (id: string) => { const v = Number($<HTMLInputElement>(id).value); return Number.isFinite(v) && v >= 0 ? v : 0; };

// tabs
const tabs = ["t1", "t2", "t3", "t4"];
tabs.forEach(t => $(t).addEventListener("click", () => {
  tabs.forEach(o => { $(o).setAttribute("aria-selected", String(o === t)); $($(o).getAttribute("aria-controls")!).hidden = o !== t; });
}));

// tab1
function calc1() {
  const out = $("r1");
  const r = parseDate($<HTMLInputElement>("receipt").value);
  if (!r) { out.textContent = "受領日を入力してください。"; return; }
  const p = parseDate($<HTMLInputElement>("planned").value);
  const rate = num("rate") / 100;
  let html = "";
  if (!p) {
    html = `最遅の支払期日の目安: <strong>${fmt(checkPayment(r, r, 0).deadline)}</strong>`;
  } else {
    const c = checkPayment(r, p, num("amount"), rate);
    html = `最遅の支払期日の目安: <strong>${fmt(c.deadline)}</strong><br>支払予定日は受領日から<strong>${c.daysFromReceipt}日目</strong>(初日算入)<br>`;
    if (c.daysFromReceipt < 1) html += `<span class="ng">支払予定日が受領日より前です。日付を確認してください。</span>`;
    else if (c.ok) html += `<span class="ok">60日以内に収まっています。</span>`;
    else html += `<span class="ng">60日を${c.overdueDays}日超過しています。</span>` + (num("amount") > 0 ? `<br>超過分の遅延利息の目安: <strong>${c.interest.toLocaleString()}円</strong>` : "");
  }
  const neg = ($<HTMLInputElement>("amount").value !== "" && Number($<HTMLInputElement>("amount").value) < 0) || Number($<HTMLInputElement>("rate").value) < 0;
  if (neg) html += `<br><span class="ng">負の値は0として扱っています。入力を確認してください。</span>`;
  out.innerHTML = html;
}
["receipt", "planned", "amount", "rate"].forEach(i => $(i).addEventListener("input", calc1));

// tab2
const closing = $<HTMLSelectElement>("closing"), payday = $<HTMLSelectElement>("payday");
closing.innerHTML = `<option value="0">末日</option>` + Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">${i + 1}日</option>`).join("");
payday.innerHTML = closing.innerHTML;
$<HTMLInputElement>("year").value = String(new Date().getFullYear());
function calc2() {
  const y = Math.trunc(num("year"));
  if (y < 2000 || y > 2100) { $("r2").textContent = "対象年は2000〜2100の範囲で入力してください。"; return; }
  const r = closingWorstCase(+closing.value, +$<HTMLSelectElement>("months").value, +payday.value, y);
  $("r2").innerHTML = `最長ケース: 受領日 ${fmt(r.worstReceipt)} → 支払日 ${fmt(r.worstPayment)}(<strong>${r.maxDays}日目</strong>)<br>` +
    (r.ok ? `<span class="ok">全ての受領日で60日以内に収まります。</span>` : `<span class="ng">60日を超える受領日があります。支払日の見直しを検討してください。</span>`);
}
["closing", "months", "payday", "year"].forEach(i => $(i).addEventListener("input", calc2));
calc2();

// tab3
function calc3() {
  const r = judgeApplicability({
    type: $<HTMLSelectElement>("type").value as "A" | "B",
    clientCapitalMan: num("cc"), clientEmployees: num("ce"),
    contractorIndividual: $<HTMLInputElement>("ind").checked,
    contractorCapitalMan: num("tc"), contractorEmployees: num("te"),
  });
  const li = (a: string[]) => a.map(x => `<li>${esc(x)}</li>`).join("");
  $("r3").innerHTML =
    `<strong>取適法(旧下請法):</strong> ${r.torite ? '<span class="ok">対象となる可能性があります</span>' : '<span class="mut">入力内容では基準に該当しません</span>'}<ul>${li(r.toriteReasons)}</ul>` +
    `<strong>フリーランス法:</strong> ${r.freelance ? '<span class="ok">対象となる可能性があります</span>' : '<span class="mut">入力内容では対象外の可能性</span>'}<ul>${li(r.freelanceReasons)}</ul>` +
    `<span class="mut">両方に該当する場合は、双方の規律を満たす必要があります。</span>`;
}
["type", "cc", "ce", "ind", "tc", "te"].forEach(i => $(i).addEventListener("input", calc3));
function syncInd() { const on = $<HTMLInputElement>("ind").checked; $<HTMLInputElement>("tc").disabled = on; }
$("ind").addEventListener("input", syncInd); syncInd(); calc3();

// tab4
const items = ["発注者・受注者の名称", "業務委託をした日", "給付(業務)の内容", "給付を受領する期日・場所", "報酬の額(算定方法でも可)", "報酬の支払期日(受領日から60日以内)", "支払方法(現金・振込等)と手数料の負担", "検査をする場合は検査完了期日", "書面または電磁的方法で明示した(口頭のみにしていない)"];
$("cl").innerHTML = items.map((t, i) => `<li><label style="display:flex;gap:8px;color:inherit;margin:0"><input type="checkbox" data-i="${i}" style="width:auto"> ${esc(t)}</label></li>`).join("");
$("copy").addEventListener("click", async () => {
  const text = items.map((t, i) => `[${($("cl").querySelector(`[data-i="${i}"]`) as HTMLInputElement).checked ? "x" : " "}] ${t}`).join("\n");
  try { await navigator.clipboard.writeText(text); $("copied").textContent = "コピーしました。"; }
  catch { $("copied").textContent = "コピーできませんでした。手動で選択してください。"; }
});
