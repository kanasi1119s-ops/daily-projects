import { BUSINESS_LABEL, calculate, cheapest, type BusinessType, type Input, type TaxYear } from "./calc";

const form = document.querySelector<HTMLFormElement>("#form")!;
const out = document.querySelector<HTMLDivElement>("#result")!;
const bt = document.querySelector<HTMLSelectElement>("#bt")!;

for (const [k, v] of Object.entries(BUSINESS_LABEL)) {
  bt.append(new Option(v, k, false, k === "5"));
}

const yen = (n: number) => (n < 0 ? "還付 " : "") + Math.abs(n).toLocaleString("ja-JP") + " 円";

function read(): Input {
  const f = new FormData(form);
  const num = (k: string) => Number(f.get(k) ?? 0);
  return {
    year: num("year") as TaxYear,
    sales: num("sales"),
    purchasesQualified: num("purchasesQualified"),
    purchasesUnqualified: num("purchasesUnqualified"),
    businessType: num("businessType") as BusinessType,
    baseSales: num("baseSales"),
    wasExempt: f.has("wasExempt"),
  };
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render(): void {
  const results = calculate(read());
  const best = cheapest(results);
  out.replaceChildren(
    ...results.map((r) => {
      const card = el("div", "card" + (r.id === best?.id ? " best" : "") + (r.available ? "" : " off"));
      const row = el("div", "row");
      const name = el("span", undefined, r.label);
      if (r.id === best?.id) name.append(el("span", "badge", "最も有利（概算）"));
      row.append(name, el("span", "amt", r.available ? yen(r.tax) : "対象外"));
      card.append(row);
      const small = el("small", r.available ? undefined : "reason", r.available ? (r.note ?? "") : (r.reason ?? ""));
      card.append(small);
      return card;
    }),
  );
}

form.addEventListener("input", render);
render();
