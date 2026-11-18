import "./style.css";
import { BIZ_LABEL, BizType, Input, SIMPLIFIED_DEADLINE, calculate, daysUntil, validate } from "./calc";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const yen = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("ja-JP")}円`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const sel = $<HTMLSelectElement>("bizType");
sel.innerHTML = (Object.keys(BIZ_LABEL) as unknown as string[])
  .map((k) => `<option value="${k}" ${k === "5" ? "selected" : ""}>${esc(BIZ_LABEL[Number(k) as BizType])}</option>`)
  .join("");

function readInput(): Input {
  const num = (id: string) => ($<HTMLInputElement>(id).value.trim() === "" ? NaN : Number($<HTMLInputElement>(id).value));
  return {
    sales: num("sales"),
    purchases: num("purchases"),
    baseSales: num("baseSales"),
    bizType: Number(sel.value) as BizType,
    isIndividual: $<HTMLInputElement>("isIndividual").checked,
    wasExempt: $<HTMLInputElement>("wasExempt").checked,
  };
}

function renderDeadline() {
  const d = daysUntil(SIMPLIFIED_DEADLINE, new Date());
  $("deadline").textContent =
    d > 0
      ? `2027年から簡易課税を使う場合の届出期限は ${SIMPLIFIED_DEADLINE}(あと${d}日)です。3割特例は届出不要です。`
      : d === 0
        ? `2027年から簡易課税を使う場合の届出期限は本日(${SIMPLIFIED_DEADLINE})です。`
        : `2027年から簡易課税を使う場合の届出期限(${SIMPLIFIED_DEADLINE})は過ぎています。国税庁の情報をご確認ください。`;
}

function render() {
  const input = readInput();
  const errs = validate(input);
  $("errors").textContent = errs.join(" / ");
  if (errs.length) {
    $("result").innerHTML = "";
    $("notes").innerHTML = "";
    return;
  }
  const r = calculate(input);
  const rows = r.methods
    .map((m) => {
      const cls = m.id === r.best ? "best" : "";
      const val = m.tax === null ? `<span class="na">対象外</span><br><small>${esc(m.reason ?? "")}</small>` : yen(m.tax);
      return `<tr class="${cls}"><td>${esc(m.name)}${m.id === r.best ? '<span class="badge">最も有利</span>' : ""}</td><td class="num">${val}</td></tr>`;
    })
    .join("");
  $("result").innerHTML = `<h2>納付税額の目安(年額・マイナスは還付)</h2><table><thead><tr><th>方式</th><th class="num">税額</th></tr></thead><tbody>${rows}</tbody></table>
  ${r.methods[1].eligible ? `<p>原則課税と簡易課税の損益分岐: 課税仕入が課税売上の約${Math.round(r.breakEvenPurchaseRatio * 100)}%を超えると原則課税が有利になります。</p>` : ""}`;
  $("notes").innerHTML = `<h2>注意点</h2><ul class="notes">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`;
}

$("form").addEventListener("input", render);
$("form").addEventListener("submit", (e) => e.preventDefault());
renderDeadline();
render();
