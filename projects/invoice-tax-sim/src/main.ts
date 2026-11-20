import { simulate, best, buyerBurden, buyerDeductionRatio, type Business } from "./calc";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const yen = (n: number) => (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("ja-JP") + "円";
const num = (el: HTMLInputElement) => {
  const v = Number(el.value);
  return Number.isFinite(v) && v > 0 ? Math.min(v, 1e12) : 0;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function render() {
  const opts = simulate({
    sales: num($("sales")), purchasesInclTax: num($("purch")),
    business: Number($<HTMLSelectElement>("biz").value) as Business, year: Number($<HTMLSelectElement>("year").value),
  });
  const b = best(opts);
  $("out").innerHTML = opts.map((o) => `
    <div class="card ${o.key === b.key ? "best" : ""}" ${o.available ? "" : 'style="opacity:.55"'}>
      <div class="row"><strong>${esc(o.label)}</strong>${o.key === b.key ? '<span class="badge">最小</span>' : ""}</div>
      <div class="tax">${o.available ? yen(o.tax) : "利用不可"}</div>
      <div class="mut">${esc(o.note)}</div>
    </div>`).join("");

  const [y, m] = ($<HTMLInputElement>("ym").value || "2026-10").split("-").map(Number);
  const ratio = buyerDeductionRatio(y, m);
  $("burden").textContent = `その時期の取引先の控除割合は${Math.round(ratio * 100)}%。控除できない消費税の目安は年${yen(buyerBurden(num($("pay")), y, m))}です。`;
}
document.querySelectorAll("input,select").forEach((e) => e.addEventListener("input", render));
render();
