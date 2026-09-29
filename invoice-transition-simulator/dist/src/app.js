import { unregisteredPurchase, compareMethods, availableSpecials } from "./logic.js";

const $ = (id) => document.getElementById(id);
const yen = (n) => `${n.toLocaleString("ja-JP")}円`;
const num = (id) => {
  const v = $(id).value;
  return v === "" ? 0 : Number(v);
};
const text = (parent, tag, str, cls) => {
  const el = document.createElement(tag);
  el.textContent = str;
  if (cls) el.className = cls;
  parent.appendChild(el);
  return el;
};

function renderA() {
  const out = $("out-a");
  out.replaceChildren();
  if (!$("a-date").value || $("a-amount").value === "") {
    text(out, "p", "取引日と金額を入力してください。");
    return;
  }
  try {
    const r = unregisteredPurchase(num("a-amount"), Number($("a-rate").value), $("a-date").value);
    text(out, "p", `控除割合: ${Math.round(r.ratio * 100)}%`);
    text(out, "p", `消費税額(国税分): ${yen(r.tax)} / 控除できる額: ${yen(r.deductible)}`);
    text(out, "p", `控除できない額(実質的な負担増): ${yen(r.nonDeductible)}`, "strong");
  } catch (e) {
    text(out, "p", e.message, "err");
  }
}

function renderB() {
  const out = $("out-b");
  out.replaceChildren();
  try {
    const year = Number($("b-year").value);
    const r = compareMethods({
      taxYear: year,
      sales10: num("b-s10"), sales8: num("b-s8"),
      businessType: Number($("b-type").value),
      purchases10: num("b-p10"), purchases8: num("b-p8"),
      unregPurchases10: num("b-u10"), unregPurchases8: num("b-u8"),
      unregRatio: Number($("b-ratio").value),
    });
    const table = document.createElement("table");
    const head = table.createTHead().insertRow();
    ["方式", "国税", "地方消費税込 合計"].forEach((h) => text(head, "th", h));
    const body = table.createTBody();
    for (const m of r.results) {
      const row = body.insertRow();
      if (m.key === r.cheapest) row.className = "best";
      text(row, "td", m.label + (m.key === r.cheapest ? " ★最少" : ""));
      text(row, "td", yen(m.national));
      text(row, "td", yen(m.total));
    }
    out.appendChild(table);
    const a = availableSpecials(year);
    if (!a.niwari && !a.sanwari) text(out, "p", "この年分は2割・3割特例の対象外です(制度は今後変更される可能性があります)。");
    text(out, "p", `課税売上に係る消費税額(国税): ${yen(r.salesTax)} / 仕入税額控除額: ${yen(r.inputTax)}`, "lead");
  } catch (e) {
    text(out, "p", e.message, "err");
  }
}

document.querySelectorAll("#form-a input, #form-a select").forEach((el) => el.addEventListener("input", renderA));
document.querySelectorAll("#form-b input, #form-b select").forEach((el) => el.addEventListener("input", renderB));
document.querySelectorAll("form").forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));
renderA();
renderB();
