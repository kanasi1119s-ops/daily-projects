import { calculate, type BusinessType, type Input } from "./calc";

const form = document.getElementById("f") as HTMLFormElement;
const rows = document.getElementById("rows") as HTMLElement;
const summary = document.getElementById("summary") as HTMLElement;
const warnings = document.getElementById("warnings") as HTMLElement;

const yen = (n: number): string => `${n < 0 ? "−" : ""}¥${Math.abs(n).toLocaleString("ja-JP")}`;

function readInput(): Input {
  const fd = new FormData(form);
  const num = (k: string): number => Number(fd.get(k) ?? 0);
  return {
    sales10: num("sales10"),
    sales8: num("sales8"),
    qualPurchase10: num("qualPurchase10"),
    qualPurchase8: num("qualPurchase8"),
    nonQualPurchase10: num("nonQualPurchase10"),
    nonQualPurchase8: num("nonQualPurchase8"),
    transitionRate: num("transitionRate"),
    businessType: num("businessType") as BusinessType,
    baseSales: num("baseSales"),
    wasExempt: fd.has("wasExempt"),
    inTwentyPercentPeriod: fd.has("inTwentyPercentPeriod"),
  };
}

function cell(tag: "td" | "th", text: string, cls?: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = text;
  if (cls) el.className = cls;
  return el;
}

function render(): void {
  const r = calculate(readInput());
  rows.replaceChildren();
  for (const m of r.methods) {
    const tr = document.createElement("tr");
    if (!m.available) tr.className = "na";
    if (m.key === r.best) tr.className = "best";
    const name = m.key === r.best ? `${m.label} ★最小` : m.label;
    tr.append(
      cell("td", name),
      cell("td", m.tax === null ? "—" : yen(m.tax), "num"),
      cell("td", m.note),
    );
    rows.append(tr);
  }
  const best = r.methods.find((m) => m.key === r.best);
  summary.textContent = best
    ? `売上に係る消費税額 ${yen(r.outputTax)}／本則の仕入税額控除 ${yen(r.inputTaxStandard)}。この条件で最も納付額が小さいのは「${best.label}」です（概算）。簡易課税・2割特例は適用要件や届出の要否を必ず確認してください。`
    : "比較できる方式がありません。";
  warnings.replaceChildren(...r.warnings.map((w) => {
    const li = document.createElement("li");
    li.textContent = w;
    return li;
  }));
}

form.addEventListener("input", render);
render();
