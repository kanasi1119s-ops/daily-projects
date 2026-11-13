import { calcInvoice, checkTNumber, divRound, REQUIRED_ITEMS, transitionalRate, type Line, type Rate, type Rounding } from "./lib";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const yen = (n: number) => n.toLocaleString("ja-JP") + "円";

function setMsg(el: HTMLElement, text: string, cls: "ok" | "ng" | "") {
  el.textContent = text;
  el.className = cls;
}

// ① T番号
$("tbtn").addEventListener("click", () => {
  const r = checkTNumber($<HTMLInputElement>("tno").value);
  if (r.ok) setMsg($("tres"), "形式OK（法人番号のチェックデジット一致）。公表サイトでの照会を忘れずに。", "ok");
  else setMsg($("tres"), r.reason, "ng");
});

$("tno").addEventListener("keydown", (e) => { if (e.key === "Enter") $("tbtn").click(); });

// ② 計算
const linesEl = $("lines");
function addLine(amount = "", rate: Rate = 10) {
  const row = document.createElement("div");
  row.className = "row";
  const inp = document.createElement("input");
  inp.inputMode = "numeric";
  inp.placeholder = "金額(円)";
  inp.value = amount;
  inp.setAttribute("aria-label", "金額");
  const sel = document.createElement("select");
  sel.setAttribute("aria-label", "税率");
  for (const r of [10, 8]) {
    const o = document.createElement("option");
    o.value = String(r);
    o.textContent = r + "%" + (r === 8 ? "（軽減）" : "");
    sel.appendChild(o);
  }
  sel.value = String(rate);
  const del = document.createElement("button");
  del.className = "sub";
  del.textContent = "削除";
  del.addEventListener("click", () => row.remove());
  row.append(inp, sel, del);
  linesEl.appendChild(row);
}
addLine();
$("add").addEventListener("click", () => addLine());

function parseAmount(s: string): number | null {
  const t = s.replace(/[，,\s円]/g, "").replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && Math.abs(n) < 1e12 ? n : null;
}

$("calc").addEventListener("click", () => {
  const out = $("cres");
  out.replaceChildren();
  const lines: Line[] = [];
  for (const row of Array.from(linesEl.children)) {
    const [inp, sel] = [row.querySelector("input")!, row.querySelector("select")!];
    if (inp.value.trim() === "") continue;
    const a = parseAmount(inp.value);
    if (a === null) return setMsg(out, "金額は整数(円)で入力してください: " + inp.value, "ng");
    lines.push({ amount: a, rate: Number(sel.value) as Rate });
  }
  if (!lines.length) return setMsg(out, "明細を入力してください", "ng");
  let res;
  try {
    res = calcInvoice(lines, $<HTMLSelectElement>("incl").value === "1", $<HTMLSelectElement>("mode").value as Rounding);
  } catch (e) {
    return setMsg(out, (e as Error).message, "ng");
  }
  const t = document.createElement("table");
  const head = t.insertRow();
  for (const h of ["税率", "税抜", "消費税", "税込"]) {
    const th = document.createElement("th");
    th.textContent = h;
    head.appendChild(th);
  }
  const addRow = (cells: string[]) => {
    const r = t.insertRow();
    cells.forEach((c) => (r.insertCell().textContent = c));
  };
  res.byRate.forEach((r) => addRow([r.rate + "%", yen(r.excl), yen(r.tax), yen(r.incl)]));
  addRow(["合計", yen(res.totalExcl), yen(res.totalTax), yen(res.totalIncl)]);
  out.className = "";
  out.appendChild(t);
});

// ③ 経過措置
$("rbtn").addEventListener("click", () => {
  const out = $("rres");
  const d = $<HTMLInputElement>("rdate").value;
  const tax = parseAmount($<HTMLInputElement>("rtax").value);
  const rate = transitionalRate(d);
  if (rate === null || tax === null || tax < 0) return setMsg(out, "取引日と消費税額(0以上の整数)を入力してください", "ng");
  const credit = divRound(tax * rate, 100, "floor");
  setMsg(out, `控除率${rate}% → 控除できる目安: ${yen(credit)}（控除不可: ${yen(tax - credit)}）`, "");
});

// ④ チェックリスト
const chk = $("chk");
for (const it of REQUIRED_ITEMS) {
  const p = document.createElement("div");
  const lab = document.createElement("label");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.addEventListener("change", updateK);
  lab.append(cb, " " + it.label + "　");
  const s = document.createElement("span");
  s.className = "note";
  s.textContent = it.hint;
  lab.appendChild(s);
  p.appendChild(lab);
  chk.appendChild(p);
}
function updateK() {
  const n = chk.querySelectorAll("input:checked").length;
  setMsg($("kres"), n === REQUIRED_ITEMS.length ? "全項目を確認しました" : `${n} / ${REQUIRED_ITEMS.length} 項目確認済み`, n === REQUIRED_ITEMS.length ? "ok" : "");
}
updateK();
