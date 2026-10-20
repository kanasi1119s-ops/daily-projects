import { simulate, parseYen, SIMPLIFIED_CATEGORIES } from "./calc.js";

const $ = (id) => document.getElementById(id);
const yen = (n) => (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("ja-JP") + "円";

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function render() {
  const input = {
    year: Number($("year").value),
    sales: parseYen($("sales").value),
    purchases: parseYen($("purchases").value),
    baseSales: parseYen($("baseSales").value),
    category: Number($("category").value),
  };
  const out = simulate(input);
  for (const id of ["sales", "purchases", "baseSales"]) {
    $(id).setAttribute("aria-invalid", String(Number.isNaN(input[id])));
  }
  const errBox = $("errors");
  const box = $("results");
  errBox.replaceChildren();
  box.replaceChildren();

  if (out.errors.length) {
    for (const m of out.errors) errBox.append(el("p", m));
    return;
  }

  box.append(el("p", `売上に含まれる消費税額 ${yen(out.outputTax)} ／ 仕入に含まれる消費税額 ${yen(out.inputTax)}`, "summary"));
  const best = out.results.find((r) => r.isBest);
  for (const r of out.results) {
    const card = el("article", null, "card" + (r.isBest ? " best" : "") + (r.eligible ? "" : " ineligible"));
    const h = el("h3", r.name);
    if (r.isBest) h.append(el("span", "最も有利", "badge best"));
    if (!r.eligible) h.append(el("span", "要件外の可能性", "badge ng"));
    card.append(h);
    card.append(el("div", (r.total < 0 ? "還付 " : "納付 ") + yen(Math.abs(r.total)), "amount" + (r.total < 0 ? " refund" : "")));
    card.append(el("p", `${r.formula}　（国税 ${yen(r.national)} ＋ 地方消費税 ${yen(r.local)}）`, "split"));
    const ul = el("ul");
    for (const n of r.notes) ul.append(el("li", n));
    card.append(ul);
    box.append(card);
  }
  if (best) {
    const std = out.results.find((r) => r.key === "standard");
    const diff = std.total - best.total;
    if (best.key !== "standard" && diff > 0) {
      box.append(el("p", `本則課税との差は約 ${yen(diff)} です（試算上の目安）。`, "summary"));
    }
  }
}

function init() {
  const sel = $("category");
  for (const [k, v] of Object.entries(SIMPLIFIED_CATEGORIES)) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = `${v.label}（${Math.round(v.rate * 100)}%）`;
    if (k === "5") o.selected = true;
    sel.append(o);
  }
  $("form").addEventListener("input", render);
  $("form").addEventListener("submit", (e) => e.preventDefault());
  render();
}

init();
