// フリーランス法(特定受託事業者に係る取引の適正化等に関する法律)対応の参考ロジック。
// 法的助言ではありません。最新の条文・公取委/厚労省の資料で必ず確認してください。

export const REQUIRED_FIELDS = [
  ["clientName", "発注事業者の名称"],
  ["freelancerName", "フリーランスの名称"],
  ["orderDate", "業務委託をした日"],
  ["description", "業務(給付)の内容"],
  ["deliveryDate", "納期(給付の期日)"],
  ["deliveryPlace", "納品場所"],
  ["amount", "報酬の額"],
  ["paymentDate", "支払期日"],
];

const MS = 86400000;
const parse = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
  const d = new Date(s + "T00:00:00Z");
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
};
const fmt = (d) => d.toISOString().slice(0, 10);

/** 受領日を起算日(1日目)として60日目 = 受領日+59日。保守的に早い側を返す。 */
export function latestPaymentDate(receiptDate) {
  const d = parse(receiptDate);
  if (!d) return null;
  return fmt(new Date(d.getTime() + 59 * MS));
}

/** 支払期日が60日ルールに収まるか。 */
export function checkPaymentDate(receiptDate, paymentDate) {
  const limit = latestPaymentDate(receiptDate);
  const p = parse(paymentDate);
  if (!limit || !p) return { ok: false, limit, reason: "受領日と支払期日を正しい日付で入力してください" };
  const ok = p.getTime() <= parse(limit).getTime();
  return { ok, limit, reason: ok ? "" : `支払期日が受領日から60日の上限(${limit})を超えています` };
}

/** 取引条件の明示事項の不足を返す。 */
export function missingItems(f = {}) {
  const miss = REQUIRED_FIELDS.filter(([k]) => !String(f[k] ?? "").trim()).map(([, l]) => l);
  if (f.inspection === "yes" && !String(f.inspectionDate ?? "").trim()) miss.push("検査完了日");
  if (f.nonCash === "yes" && !String(f.nonCashMethod ?? "").trim()) miss.push("報酬の支払方法(現金以外)");
  return miss;
}

/** 発注書テキスト生成。 */
export function buildOrderSheet(f = {}) {
  const miss = missingItems(f);
  const v = (k) => String(f[k] ?? "").trim() || "【未記入】";
  const lines = [
    "業務委託に係る取引条件通知書(ひな形)", "",
    `発注事業者: ${v("clientName")}`,
    `受託者(フリーランス): ${v("freelancerName")}`,
    `委託日: ${v("orderDate")}`,
    `業務内容: ${v("description")}`,
    `納期: ${v("deliveryDate")}`,
    `納品場所: ${v("deliveryPlace")}`,
  ];
  if (f.inspection === "yes") lines.push(`検査完了日: ${v("inspectionDate")}`);
  lines.push(`報酬額: ${v("amount")}`, `支払期日: ${v("paymentDate")}`);
  if (f.nonCash === "yes") lines.push(`支払方法: ${v("nonCashMethod")}`);
  lines.push("", "※本書はひな形です。内容は当事者が確認し、必要に応じて専門家に相談してください。");
  const warnings = [];
  if (f.deliveryDate && f.paymentDate) {
    const c = checkPaymentDate(f.deliveryDate, f.paymentDate);
    if (!c.ok && c.limit) warnings.push(`納期を受領日と仮定すると、${c.reason}`);
  }
  return { text: lines.join("\n"), missing: miss, warnings };
}

export const DIAGNOSIS_QUESTIONS = [
  { id: "written", text: "発注時に、書面またはメール等で取引条件を明示している", good: true, tip: "業務内容・報酬額・支払期日などを発注時にすぐ明示します(3条)。" },
  { id: "pay60", text: "報酬は、納品物を受け取った日から60日以内の支払期日に設定している", good: true, tip: "受領日から60日以内でできる限り短い期間に設定します(4条)。" },
  { id: "refuse", text: "納品物の受領を、フリーランス側に落ち度なく拒んだことがある", good: false, tip: "受領拒否は禁止行為の例です(5条、1か月以上の委託)。" },
  { id: "cut", text: "契約後に、フリーランス側に落ち度なく報酬を減額したことがある", good: false, tip: "報酬の減額は禁止行為の例です(5条)。" },
  { id: "redo", text: "費用負担なしの無制限なやり直しを求めたことがある", good: false, tip: "不当なやり直し・給付内容の変更は禁止行為の例です(5条)。" },
  { id: "lowprice", text: "通常の相場より著しく低い報酬を一方的に決めたことがある", good: false, tip: "買いたたきは禁止行為の例です(5条)。" },
  { id: "notice", text: "6か月以上の継続委託を中途解約・更新しない場合に30日前までに予告している", good: true, tip: "6か月以上の委託では原則30日前までの予告が必要です(16条)。" },
  { id: "harass", text: "ハラスメント対策の相談窓口など体制を整備している", good: true, tip: "ハラスメント対策に必要な体制整備が求められます(14条)。" },
];

/** answers: {id: true|false}。未回答は「要確認」。 */
export function diagnose(answers = {}) {
  const issues = [], unknown = [];
  for (const q of DIAGNOSIS_QUESTIONS) {
    const a = answers[q.id];
    if (a === undefined || a === null) unknown.push(q);
    else if (a !== q.good) issues.push(q);
  }
  return { issues, unknown, level: issues.length ? "要対応" : unknown.length ? "未回答あり" : "指摘なし" };
}
