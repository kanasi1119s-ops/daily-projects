import { simulate, CATEGORY_LABEL, defaultExemptRate } from "./calc.js";

const $ = (s) => document.querySelector(s);
const form = $("#f");
const yen = (n) => (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("ja-JP") + "円";

for (const [k, v] of Object.entries(CATEGORY_LABEL)) {
  const o = document.createElement("option");
  o.value = k;
  o.textContent = v;
  if (k === "5") o.selected = true;
  $("#category").append(o);
}

function read() {
  const d = new FormData(form);
  const n = (k) => Number(d.get(k));
  return {
    year: n("year"), baseSales: n("baseSales"), registered: form.registered.checked,
    category: n("category"), salesStd: n("salesStd"), salesRed: n("salesRed"),
    purchStd: n("purchStd"), purchRed: n("purchRed"), exemptPurch: n("exemptPurch"),
    exemptRate: n("exemptRate") / 100,
  };
}

function render() {
  const inp = read();
  const bad = ["baseSales", "salesStd", "salesRed", "purchStd", "purchRed", "exemptPurch", "exemptRate"].some((k) => !Number.isFinite(inp[k]) || inp[k] < 0 || (k === "exemptRate" && inp[k] > 1));
  $("#warn").hidden = !bad;
  const r = simulate(inp);
  const max = Math.max(1, ...r.results.map((x) => Math.abs(x.amount)));
  const box = $("#bars");
  box.replaceChildren();
  for (const x of r.results) {
    const row = document.createElement("div");
    row.className = "row" + (x.key === r.bestKey ? " best" : "") + (x.eligible ? "" : " ng");
    const head = document.createElement("div");
    head.className = "head";
    const name = document.createElement("span");
    name.textContent = x.name;
    if (x.key === r.bestKey) {
      const b = document.createElement("span");
      b.className = "badge";
      b.textContent = " ★最安";
      name.append(b);
    }
    const amt = document.createElement("span");
    amt.textContent = yen(x.amount);
    head.append(name, amt);
    const bar = document.createElement("div");
    bar.className = "bar" + (x.amount < 0 ? " neg" : "");
    bar.style.width = (Math.abs(x.amount) / max) * 100 + "%";
    row.append(head, bar);
    if (!x.eligible) {
      const t = document.createElement("p");
      t.className = "rs";
      t.textContent = "対象外: " + x.reasons.join(" / ");
      row.append(t);
    } else for (const s of x.reasons) {
      const t = document.createElement("p");
      t.className = "rs";
      t.textContent = "注: " + s;
      row.append(t);
    }
    box.append(row);
  }
  const best = r.results.find((x) => x.key === r.bestKey);
  $("#summary").textContent = `売上税額 ${yen(r.salesTax)}／仕入税額 ${yen(r.purchaseTax)}。申告額が最小となる方式は「${best.name}」（${yen(best.amount)}）。`;
}

$("select[name=year]").addEventListener("change", (e) => {
  $("#exemptRate").value = Math.round(defaultExemptRate(Number(e.target.value)) * 100);
});
form.addEventListener("input", render);
form.addEventListener("change", render);
form.addEventListener("submit", (e) => e.preventDefault());
render();
