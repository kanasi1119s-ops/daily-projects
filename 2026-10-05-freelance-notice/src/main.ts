import { emptyInput, validateNotice, renderNotice, checkPaymentDate, type NoticeInput } from "./logic";

type Field = { key: keyof NoticeInput; label: string; type: "text" | "date" | "area" | "check" };
const FIELDS: Field[] = [
  { key: "clientName", label: "発注事業者の名称", type: "text" },
  { key: "freelancerName", label: "フリーランスの名称", type: "text" },
  { key: "contractDate", label: "業務委託をした日", type: "date" },
  { key: "workDescription", label: "業務の内容", type: "area" },
  { key: "deliveryDate", label: "給付の期日（納期）", type: "date" },
  { key: "deliveryPlace", label: "給付の提供場所（メール納品等も可）", type: "text" },
  { key: "inspection", label: "検査（検収）を行う", type: "check" },
  { key: "inspectionDate", label: "検査完了日", type: "date" },
  { key: "fee", label: "報酬の額（金額、または算定方法）", type: "text" },
  { key: "paymentDate", label: "報酬の支払期日", type: "date" },
  { key: "paymentMethod", label: "支払方法（現金以外の場合のみ）", type: "text" },
];

const state: NoticeInput = emptyInput();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function build() {
  const form = $("f");
  for (const f of FIELDS) {
    const wrap = document.createElement("label");
    wrap.id = `w-${f.key}`;
    wrap.textContent = f.label;
    let el: HTMLInputElement | HTMLTextAreaElement;
    if (f.type === "area") { el = document.createElement("textarea"); el.rows = 3; }
    else { el = document.createElement("input"); el.type = f.type === "check" ? "checkbox" : f.type; }
    el.name = f.key;
    el.addEventListener("input", () => {
      (state as unknown as Record<string, unknown>)[f.key] = f.type === "check" ? (el as HTMLInputElement).checked : el.value;
      render();
    });
    if (f.type === "check") { wrap.prepend(el, " "); } else wrap.append(el);
    form.append(wrap);
  }
}

function render() {
  $("w-inspectionDate").style.display = state.inspection ? "" : "none";
  const issues = validateNotice(state);
  const box = $("issues");
  box.replaceChildren();
  if (issues.length === 0) {
    const p = document.createElement("p"); p.className = "ok"; p.textContent = "必須の明示事項はすべて入力されています。"; box.append(p);
  } else {
    const ul = document.createElement("ul");
    for (const i of issues) { const li = document.createElement("li"); li.className = "err"; li.textContent = i.message; ul.append(li); }
    box.append(ul);
  }
  const ready = issues.length === 0;
  $<HTMLButtonElement>("copy").disabled = !ready;
  $<HTMLButtonElement>("print").disabled = !ready;
  $("out").textContent = ready ? renderNotice(state) : "未記入の項目を入力すると、ここに通知書が表示されます。";
  renderPay();
}

function renderPay() {
  const r = $<HTMLInputElement>("receipt").value;
  const pay = $("pay");
  if (!r || !state.paymentDate) { pay.textContent = "受領日と支払期日を入力すると判定します（受領日を1日目として60日以内）。"; pay.className = "note"; return; }
  const c = checkPaymentDate(r, state.paymentDate);
  pay.textContent = c.message; pay.className = c.ok ? "ok" : "err";
}

$("receipt").addEventListener("input", renderPay);
$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("out").textContent ?? ""); $("msg").textContent = "コピーしました"; }
  catch { $("msg").textContent = "コピーに失敗しました。手動で選択してください"; }
});
$("print").addEventListener("click", () => window.print());
build();
render();
