import { buildFileName, dedupe, toCsv, DOC_TYPES } from "./rules.js";

const $ = (id) => document.getElementById(id);
/** @type {{file:File,date:string,vendor:string,amount:string,type:string}[]} */
let items = [];

function row(i) {
  const it = items[i];
  const div = document.createElement("div");
  div.className = "row";
  div.dataset.i = i;
  const mk = (key, label, ph) => {
    const l = document.createElement("label");
    l.append(Object.assign(document.createElement("small"), { textContent: label }));
    const inp = document.createElement("input");
    inp.value = it[key];
    inp.placeholder = ph;
    inp.dataset.k = key;
    inp.autocomplete = "off";
    l.append(inp);
    return l;
  };
  const sel = document.createElement("select");
  sel.dataset.k = "type";
  for (const t of DOC_TYPES) sel.append(new Option(t, t, false, t === it.type));
  const sl = document.createElement("label");
  sl.append(Object.assign(document.createElement("small"), { textContent: "種別" }), sel);
  const orig = Object.assign(document.createElement("div"), { className: "orig", textContent: "元: " + it.file.name });
  const res = Object.assign(document.createElement("div"), { className: "res" });
  div.append(orig, mk("date", "取引年月日", "2026-10-11 / R8.10.11"), mk("vendor", "取引先", "株式会社〇〇"), mk("amount", "取引金額(円)", "12,000"), sl, res);
  return div;
}

function results() {
  const order = $("order").value;
  const built = items.map((it) => buildFileName({ original: it.file.name, order, ...it }));
  const names = dedupe(built.map((b) => (b.ok ? b.name : "")));
  return built.map((b, i) => ({ ...b, name: names[i] }));
}

function refresh() {
  const rs = results();
  document.querySelectorAll(".row").forEach((div, i) => {
    const r = rs[i], el = div.querySelector(".res");
    el.className = "res " + (r.ok ? "ok" : "err");
    el.textContent = r.ok ? "→ " + r.name : r.errors.join(" / ");
  });
  const any = items.length > 0;
  const allOk = any && rs.every((r) => r.ok);
  $("dlAll").disabled = !allOk;
  $("dlCsv").disabled = !allOk;
  $("apply").disabled = items.length < 2;
  $("clear").disabled = !any;
  $("status").textContent = any ? `${rs.filter((r) => r.ok).length}/${rs.length} 件 入力OK` : "";
}

function render() {
  const list = $("list");
  list.replaceChildren();
  if (items.length) {
    const card = document.createElement("div");
    card.className = "card";
    items.forEach((_, i) => card.append(row(i)));
    list.append(card);
  }
  refresh();
}

function add(files) {
  for (const f of files) items.push({ file: f, date: "", vendor: "", amount: "", type: "領収書" });
  render();
}

function save(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("drop").addEventListener("click", () => $("file").click());
$("drop").addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), $("file").click()));
$("file").addEventListener("change", (e) => { add([...e.target.files]); e.target.value = ""; });
for (const ev of ["dragenter", "dragover"]) $("drop").addEventListener(ev, (e) => { e.preventDefault(); $("drop").classList.add("over"); });
for (const ev of ["dragleave", "drop"]) $("drop").addEventListener(ev, (e) => { e.preventDefault(); $("drop").classList.remove("over"); });
$("drop").addEventListener("drop", (e) => add([...e.dataTransfer.files]));

$("list").addEventListener("input", (e) => {
  const div = e.target.closest(".row");
  if (!div || !e.target.dataset.k) return;
  items[Number(div.dataset.i)][e.target.dataset.k] = e.target.value;
  refresh();
});
$("order").addEventListener("change", refresh);
$("clear").addEventListener("click", () => { items = []; render(); });
$("apply").addEventListener("click", () => {
  const [first] = items;
  items.forEach((it) => { it.vendor = first.vendor; it.type = first.type; });
  render();
});
$("dlAll").addEventListener("click", async () => {
  const rs = results();
  for (let i = 0; i < items.length; i++) {
    save(items[i].file, rs[i].name);
    await new Promise((r) => setTimeout(r, 250)); // ブラウザの連続DL抑止を避ける
  }
});
$("dlCsv").addEventListener("click", () => {
  const rs = results();
  const rows = items.map((it, i) => ({ name: rs[i].name, original: it.file.name, date: it.date, vendor: it.vendor, amount: it.amount, type: it.type }));
  save(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), "索引.csv");
});
