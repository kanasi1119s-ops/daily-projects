import { calculate, parseTable, toCsv, type Entry, type TaxRate } from "./calc";
import { SCHEDULE } from "./schedule";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

let entries: Entry[] = [];

function td(text: string, cls?: string): HTMLTableCellElement {
  const c = document.createElement("td");
  c.textContent = text; // textContent のみ使用（取引先名のXSS対策）
  if (cls) c.className = cls;
  return c;
}

function renderSchedule() {
  const body = document.querySelector<HTMLTableSectionElement>("#schedule tbody")!;
  body.replaceChildren(
    ...SCHEDULE.map((p) => {
      const tr = document.createElement("tr");
      tr.append(td(`${p.from} 〜 ${p.to}`), td(`${Math.round(p.ratio * 100)}%`));
      return tr;
    }),
  );
}

function render() {
  const s = calculate(entries);
  $("t-tax").textContent = yen(s.totalTax);
  $("t-ded").textContent = yen(s.totalDeductible);
  $("t-non").textContent = yen(s.totalNonDeductible);
  $("cap-msg").hidden = !s.capWarning;
  const body = document.querySelector<HTMLTableSectionElement>("#result tbody")!;
  if (s.lines.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "empty";
    const c = td("取引を追加すると、ここに結果が表示されます。");
    c.colSpan = 9;
    tr.append(c);
    body.replaceChildren(tr);
    return;
  }
  body.replaceChildren(
    ...s.lines.map((l, i) => {
      const tr = document.createElement("tr");
      const del = document.createElement("button");
      del.type = "button";
      del.className = "del";
      del.textContent = "削除";
      del.setAttribute("aria-label", `${l.date} ${l.supplier || "取引先未入力"} を削除`);
      del.addEventListener("click", () => {
        entries.splice(i, 1);
        render();
      });
      const last = document.createElement("td");
      last.append(del);
      tr.append(
        td(l.date), td(l.supplier), td(yen(l.amount), "num"), td(`${l.rate}%`), td(yen(l.tax), "num"),
        td(l.ratioLabel), td(yen(l.deductible), "num"), td(yen(l.nonDeductible), "num"), last,
      );
      return tr;
    }),
  );
}

$<HTMLFormElement>("add").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const f = ev.currentTarget as HTMLFormElement;
  const fd = new FormData(f);
  const date = String(fd.get("date") ?? "");
  const amountStr = String(fd.get("amount") ?? "").trim();
  const amount = Number(amountStr);
  const msg = $("form-msg");
  if (!date) return void (msg.textContent = "取引日を入力してください。");
  if (amountStr === "" || !Number.isInteger(amount) || amount < 0) return void (msg.textContent = "税込金額は0以上の整数で入力してください。");
  msg.textContent = "";
  entries.push({ date, supplier: String(fd.get("supplier") ?? "").trim(), amount, rate: Number(fd.get("rate")) as TaxRate, registered: fd.get("registered") === "on" });
  f.reset();
  render();
});

$("import").addEventListener("click", () => {
  const ta = $<HTMLTextAreaElement>("paste");
  const { entries: added, errors } = parseTable(ta.value);
  entries.push(...added);
  $("import-msg").textContent = errors.length ? errors.slice(0, 5).join(" / ") + (errors.length > 5 ? ` ほか${errors.length - 5}件` : "") : "";
  if (added.length) ta.value = "";
  render();
});

$("csv").addEventListener("click", () => {
  const blob = new Blob([toCsv(calculate(entries))], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "invoice-keika-result.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("clear").addEventListener("click", () => {
  if (entries.length === 0 || confirm("入力した取引をすべて削除します。よろしいですか？")) {
    entries = [];
    render();
  }
});

renderSchedule();
render();
