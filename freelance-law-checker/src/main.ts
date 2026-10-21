import "./style.css";
import { checkPayment, LABELS, REQUIRED, missingFields, renderTerms, type Mode, type Terms } from "./logic";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const mode = $<HTMLSelectElement>("mode");
mode.addEventListener("change", () => {
  $("closing-wrap").hidden = mode.value !== "monthly";
});

$("pay-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const out = $("pay-result");
  const r = checkPayment({
    receivedDate: $<HTMLInputElement>("received").value,
    dueDate: $<HTMLInputElement>("due").value,
    mode: mode.value as Mode,
    closingDay: Number($<HTMLInputElement>("closing").value),
  });
  out.textContent = "";
  const p = document.createElement("p");
  if ("error" in r) {
    p.className = "ng";
    p.textContent = r.error;
  } else {
    p.className = r.ok ? "ok" : "ng";
    p.textContent = `${r.ok ? "OK" : "要見直し"}: ${r.message}(起算日 ${r.baseDate} / 60日目 ${r.limitDate})`;
  }
  out.appendChild(p);
});

// 取引条件フォーム
const fields = Object.keys(LABELS) as (keyof Terms)[];
const state: Terms = { clientName: "", freelancerName: "", work: "", fee: "", dueDate: "", deliveryDate: "", deliveryPlace: "", inspectionDate: "", paymentMethod: "" };
const form = $("terms-form");
for (const k of fields) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = LABELS[k];
  if (REQUIRED.includes(k)) span.className = "req";
  const input = document.createElement("input");
  input.type = "text";
  input.addEventListener("input", () => {
    state[k] = input.value;
    refresh();
  });
  label.append(span, input);
  form.appendChild(label);
}
form.addEventListener("submit", (e) => e.preventDefault());

function refresh() {
  const miss = missingFields(state);
  $("terms-warn").textContent = miss.length ? `未入力の必須項目: ${miss.map((k) => LABELS[k]).join("、")}` : "必須項目はすべて入力済みです。";
  $("terms-out").textContent = renderTerms(state);
}
refresh();

$("copy").addEventListener("click", async () => {
  const msg = $("copy-msg");
  try {
    await navigator.clipboard.writeText($("terms-out").textContent ?? "");
    msg.textContent = "コピーしました";
  } catch {
    msg.textContent = "コピーできませんでした。手動で選択してください。";
  }
});
