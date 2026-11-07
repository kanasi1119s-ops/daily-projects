import {
  CATEGORIES, CYCLES, assess, duplicateCategories, fromCsv, monthlyCost,
  sampleData, simulateCancel, toCsv, totals, validateSubscription,
  type Subscription, type Verdict,
} from "./logic";
import { load, save } from "./storage";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const yen = (n: number) => `${Math.round(n).toLocaleString("ja-JP")}円`;
const newId = () =>
  (globalThis.crypto && "randomUUID" in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

let subs: Subscription[] = load();
let editingId: string | null = null;
const cancelSet = new Set<string>();

const form = $<HTMLFormElement>("add-form");
const verdictLabel: Record<Verdict, string> = { cancel: "解約候補", review: "要見直し", keep: "継続でOK", unknown: "判定不可" };

for (const c of CATEGORIES) {
  const o = document.createElement("option");
  o.value = c;
  o.textContent = c;
  $("category").appendChild(o);
}

function persist() {
  if (!save(subs)) setMsg("ブラウザの保存領域に書き込めませんでした。このまま使えますが、再読み込みで消えます。");
}
function setMsg(t: string) { $("data-msg").textContent = t; }

function td(text: string, cls?: string): HTMLTableCellElement {
  const c = document.createElement("td");
  c.textContent = text;
  if (cls) c.className = cls;
  return c;
}

function btn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function render() {
  const tbody = $("tbody");
  tbody.replaceChildren();
  $("empty").hidden = subs.length > 0;
  $("table").hidden = subs.length === 0;

  const t = totals(subs);
  const summary = $("summary");
  summary.replaceChildren();
  const stat = (v: string, l: string) => {
    const d = document.createElement("div");
    d.className = "stat";
    const b = document.createElement("b");
    b.textContent = v;
    const s = document.createElement("span");
    s.textContent = l;
    d.append(b, s);
    summary.appendChild(d);
  };
  stat(yen(t.monthly), "月額合計(換算)");
  stat(yen(t.yearly), "年額合計(換算)");
  stat(`${subs.length}件`, "登録数");

  const dups = duplicateCategories(subs);
  $("dup-note").textContent = dups.length ? `重複の可能性があるカテゴリ: ${dups.join("、")}` : "";

  // 月額換算の高い順
  const sorted = [...subs].sort((a, b) => monthlyCost(b) - monthlyCost(a));
  for (const s of sorted) {
    const a = assess(s, subs);
    const tr = document.createElement("tr");

    const chkTd = document.createElement("td");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = cancelSet.has(s.id);
    chk.setAttribute("aria-label", `${s.name}を解約した場合を試算`);
    chk.addEventListener("change", () => {
      if (chk.checked) cancelSet.add(s.id); else cancelSet.delete(s.id);
      renderSim();
    });
    chkTd.appendChild(chk);

    const nameTd = td(`${s.name}(${s.category} / ${CYCLES[s.cycle].label} ${yen(s.price)})`);
    const cpu = a.costPerUse === null ? "-" : a.costPerUse === Infinity ? "未利用" : yen(a.costPerUse);
    const opsTd = document.createElement("td");
    opsTd.append(btn("編集", () => startEdit(s)), btn("削除", () => remove(s.id)));

    tr.append(chkTd, nameTd, td(verdictLabel[a.verdict], `v-${a.verdict}`), td(yen(monthlyCost(s))), td(cpu), td(a.reasons.join(" / ")), opsTd);
    tbody.appendChild(tr);
  }
  renderSim();
}

function renderSim() {
  const el = $("sim");
  const ids = new Set([...cancelSet].filter((id) => subs.some((s) => s.id === id)));
  if (ids.size === 0) { el.textContent = "左端のチェックを入れると、解約した場合の節約額を試算します。"; return; }
  const r = simulateCancel(subs, ids);
  el.textContent = `${ids.size}件を解約した場合の試算: 月 ${yen(r.monthly)} / 年 ${yen(r.yearly)} の支出減(入力値に基づく目安です)`;
}

function remove(id: string) {
  subs = subs.filter((s) => s.id !== id);
  cancelSet.delete(id);
  if (editingId === id) stopEdit();
  persist(); render();
}

function startEdit(s: Subscription) {
  editingId = s.id;
  const set = (n: string, v: string) => ((form.elements.namedItem(n) as HTMLInputElement).value = v);
  set("name", s.name); set("price", String(s.price)); set("cycle", s.cycle); set("category", s.category);
  set("usesPerMonth", s.usesPerMonth === null ? "" : String(s.usesPerMonth));
  set("annualPrice", s.annualPrice === null ? "" : String(s.annualPrice));
  set("note", s.note);
  $("submit-btn").textContent = "更新する";
  $("cancel-edit").hidden = false;
  form.scrollIntoView({ behavior: "smooth" });
}
function stopEdit() {
  editingId = null;
  form.reset();
  $("submit-btn").textContent = "追加する";
  $("cancel-edit").hidden = true;
}
$("cancel-edit").addEventListener("click", () => { stopEdit(); $("form-errors").textContent = ""; });

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const g = (k: string) => String(fd.get(k) ?? "");
  const res = validateSubscription(
    { name: g("name"), price: g("price"), cycle: g("cycle"), category: g("category"), usesPerMonth: g("usesPerMonth"), annualPrice: g("annualPrice"), note: g("note") },
    editingId ?? newId(),
  );
  if (!res.ok || !res.value) { $("form-errors").textContent = res.errors.join(" / "); return; }
  $("form-errors").textContent = "";
  if (editingId) subs = subs.map((s) => (s.id === editingId ? res.value! : s));
  else subs.push(res.value);
  stopEdit(); persist(); render();
});

$("sample-btn").addEventListener("click", () => { subs = subs.concat(sampleData(newId)); persist(); render(); setMsg("サンプル(ダミー数値)を追加しました。"); });

$("export-btn").addEventListener("click", () => {
  if (!subs.length) { setMsg("書き出すデータがありません。"); return; }
  const blob = new Blob(["﻿" + toCsv(subs)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "sabuhen.csv";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  setMsg("CSVを書き出しました。");
});

$<HTMLInputElement>("import-file").addEventListener("change", async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 1_000_000) { setMsg("ファイルが大きすぎます(上限1MB)。"); input.value = ""; return; }
  const r = fromCsv(await file.text(), newId);
  subs = subs.concat(r.subs);
  persist(); render();
  setMsg(`${r.subs.length}件を読み込みました。` + (r.errors.length ? ` 取り込めなかった行: ${r.errors.slice(0, 5).join(" ; ")}` : ""));
  input.value = "";
});

$("clear-btn").addEventListener("click", () => {
  if (!subs.length) return;
  if (!confirm("登録した全データを削除します。よろしいですか?")) return;
  subs = []; cancelSet.clear(); stopEdit(); persist(); render(); setMsg("全データを削除しました。");
});

render();
