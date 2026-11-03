import { calculate, formatYen, BUSINESS_TYPES, TAX_YEARS } from "./calc.js";

const $ = (id) => document.getElementById(id);
const f = $("f");
for (const [k, v] of Object.entries(TAX_YEARS)) $("taxYear").add(new Option(v, k));
$("taxYear").value = "R9";
for (const [k, v] of Object.entries(BUSINESS_TYPES)) $("businessType").add(new Option(`${v.label} ${v.rate * 100}%`, k));
$("businessType").value = "5";

function cell(tag, text, cls) {
  const e = document.createElement(tag);
  e.textContent = text; // textContent のみ使用（XSS対策）
  if (cls) e.className = cls;
  return e;
}

f.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(f);
  const err = $("err");
  try {
    for (const k of ["sales", "purchases", "baseYearSales"]) {
      if (String(fd.get(k)).trim() === "") throw new RangeError("すべての金額を入力してください");
    }
    const r = calculate({
      sales: fd.get("sales"),
      purchases: fd.get("purchases"),
      baseYearSales: fd.get("baseYearSales"),
      businessType: Number(fd.get("businessType")),
      taxYear: fd.get("taxYear"),
      isIndividual: fd.get("isIndividual") === "on",
      registeredFromExempt: fd.get("registeredFromExempt") === "on",
    });
    err.hidden = true;
    const rows = $("rows");
    rows.replaceChildren();
    for (const x of r.results) {
      const tr = document.createElement("tr");
      if (x === r.best) tr.className = "best";
      else if (!x.eligible) tr.className = "ng";
      tr.append(cell("td", x.label + (x === r.best ? "（最安）" : x.eligible ? "" : "（対象外）")),
        cell("td", x.eligible ? formatYen(x.tax) : "—", "n"), cell("td", x.note));
      rows.append(tr);
    }
    $("summary").textContent = r.savingVsWorst > 0
      ? `選択可能な方式の中では「${r.best.label}」が最も低く、最大 ${formatYen(r.savingVsWorst)} の差があります。`
      : `選択可能な方式の納付額は同額です。`;
    $("hint").textContent = r.exemptHint ?? "";
    $("out").hidden = false;
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
    $("out").hidden = true;
  }
});

// 入力が変わったら古い結果を隠す（再計算前の結果を誤読させない）
f.addEventListener("input", () => { $("out").hidden = true; });
