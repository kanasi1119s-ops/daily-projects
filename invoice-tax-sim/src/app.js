import { simulate } from "./calc.js";

const $ = (id) => document.getElementById(id);
const yen = (n) => `${n.toLocaleString("ja-JP")}円`;
const today = new Date().toISOString().slice(0, 10);
$("asof").value = today;

function readNumber(id) {
  const raw = $(id).value.trim();
  return raw === "" ? NaN : Number(raw);
}

function render() {
  const err = $("err");
  const out = $("out");
  const nq = readNumber("nq");
  try {
    const r = simulate({
      sales: readNumber("sales"),
      purchases: readNumber("purchases"),
      nonQualifiedRatio: nq / 100,
      businessType: Number($("bt").value),
      asOf: $("asof").value || today,
      twoTenthsEligible: $("elig").checked,
    });
    err.hidden = true;
    out.replaceChildren();
    for (const [key, m] of Object.entries(r.methods)) {
      const card = document.createElement("div");
      card.className = "card" + (key === r.best ? " best" : "");
      const title = document.createElement("div");
      title.textContent = m.label + " ";
      if (key === r.best) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "最も低い";
        title.append(badge);
      }
      const val = document.createElement("b");
      val.textContent = m.tax === null ? "対象外(前提OFF)" : yen(m.tax);
      card.append(title, val);
      out.append(card);
    }
    const sum = document.createElement("p");
    sum.textContent = `最も低い方式での月々の積立目安: ${yen(r.monthlyReserve)}(売上税額 ${yen(r.outputTax)}、仕入税額控除 ${yen(r.inputTax)}、非適格仕入の控除率 ${Math.round(r.creditRate * 100)}%)`;
    out.append(sum);
    if (r.refund > 0) {
      const rf = document.createElement("p");
      rf.textContent = `本則課税では仕入税額が上回り、約${yen(r.refund)}の還付見込みです(還付申告が必要。表示上の納税額は0円)。`;
      out.append(rf);
    }
  } catch (e) {
    err.hidden = false;
    err.textContent = e instanceof RangeError ? e.message : "入力を確認してください";
    out.replaceChildren();
  }
}

$("f").addEventListener("input", render);
render();
