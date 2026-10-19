import { emptyInput, hasError, render, validate, type NoticeInput } from "./notice";
import "./style.css";

const form = document.querySelector<HTMLFormElement>("#form")!;
const out = document.querySelector<HTMLPreElement>("#output")!;
const issuesEl = document.querySelector<HTMLUListElement>("#issues")!;
const copyBtn = document.querySelector<HTMLButtonElement>("#copy")!;
const printBtn = document.querySelector<HTMLButtonElement>("#print")!;
const dlBtn = document.querySelector<HTMLButtonElement>("#download")!;

function read(): NoticeInput {
  const v: NoticeInput = { ...emptyInput };
  for (const key of Object.keys(emptyInput) as (keyof NoticeInput)[]) {
    const el = form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!el) continue;
    if (el instanceof HTMLSelectElement) (v[key] as string) = el.value;
    else if (el instanceof HTMLInputElement && el.type === "checkbox") (v[key] as boolean) = el.checked;
    else (v[key] as string) = el.value;
  }
  return v;
}

function update() {
  const input = read();
  const issues = validate(input);
  issuesEl.replaceChildren(
    ...issues.map((x) => {
      const li = document.createElement("li");
      li.className = x.level;
      li.textContent = (x.level === "error" ? "【要入力】" : "【注意】") + x.message;
      return li;
    }),
  );
  const ok = !hasError(issues);
  out.textContent = ok ? render(input) : "必須項目を入力すると、ここに明示書が表示されます。";
  copyBtn.disabled = printBtn.disabled = dlBtn.disabled = !ok;
  form.querySelector<HTMLElement>("#inspection-row")!.hidden = !input.hasInspection;
}

form.addEventListener("input", update);
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(out.textContent ?? "");
    copyBtn.textContent = "コピーしました";
  } catch {
    copyBtn.textContent = "コピー失敗: 手動で選択してください";
  }
  setTimeout(() => (copyBtn.textContent = "テキストをコピー"), 1500);
});
printBtn.addEventListener("click", () => window.print());
dlBtn.addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([out.textContent ?? ""], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = "torihiki-joken-meiji.txt"; a.click();
  URL.revokeObjectURL(url);
});
update();
