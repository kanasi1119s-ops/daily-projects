/** 消費税(国税+地方消費税) 合計10%で計算。軽減税率・複数事業区分は非対応(MVP)。 */
export const TAX_RATE = 0.1;

export type BizType = 1 | 2 | 3 | 4 | 5 | 6;

/** 簡易課税のみなし仕入率 */
export const DEEMED_RATIO: Record<BizType, number> = { 1: 0.9, 2: 0.8, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.4 };

export const BIZ_LABEL: Record<BizType, string> = {
  1: "第1種(卸売業)",
  2: "第2種(小売業・農林水産業(飲食料品))",
  3: "第3種(製造業・建設業など)",
  4: "第4種(飲食店業・その他)",
  5: "第5種(運輸通信・金融保険・サービス業)",
  6: "第6種(不動産業)",
};

export interface Input {
  /** 2027年の見込み課税売上高(税抜・円) */
  sales: number;
  /** 2027年の見込み課税仕入高(税抜・円)。適格請求書あり前提 */
  purchases: number;
  /** 基準期間(2025年)の課税売上高(税抜・円) */
  baseSales: number;
  bizType: BizType;
  /** 個人事業主か */
  isIndividual: boolean;
  /** インボイス登録を機に免税事業者から課税事業者になったか */
  wasExempt: boolean;
}

export type MethodId = "standard" | "simplified" | "thirty";

export interface MethodResult {
  id: MethodId;
  name: string;
  eligible: boolean;
  reason?: string;
  /** 納付税額(マイナスは還付)。不適格のときは null */
  tax: number | null;
}

export interface Result {
  methods: MethodResult[];
  best: MethodId | null;
  /** 原則課税と簡易課税が同額になる仕入率(課税仕入/課税売上) */
  breakEvenPurchaseRatio: number;
  warnings: string[];
}

const floorYen = (n: number) => Math.floor(n);

export function validate(i: Input): string[] {
  const e: string[] = [];
  for (const [k, v] of [["課税売上高", i.sales], ["課税仕入高", i.purchases], ["基準期間の課税売上高", i.baseSales]] as const) {
    if (!Number.isFinite(v) || v < 0) e.push(`${k}は0以上の数値を入力してください`);
  }
  return e;
}

export function calculate(i: Input): Result {
  const outTax = floorYen(i.sales * TAX_RATE);
  const inTax = floorYen(i.purchases * TAX_RATE);
  const ratio = DEEMED_RATIO[i.bizType];
  const warnings: string[] = [];

  const standard: MethodResult = { id: "standard", name: "原則課税", eligible: true, tax: outTax - inTax };

  const simpOk = i.baseSales <= 50_000_000;
  const simplified: MethodResult = {
    id: "simplified",
    name: `簡易課税(みなし仕入率${Math.round(ratio * 100)}%)`,
    eligible: simpOk,
    reason: simpOk ? undefined : "基準期間の課税売上高が5,000万円を超えるため利用できません",
    tax: simpOk ? outTax - floorYen(outTax * ratio) : null,
  };

  let thirtyReason: string | undefined;
  if (!i.isIndividual) thirtyReason = "3割特例は個人事業者のみが対象です";
  else if (!i.wasExempt) thirtyReason = "インボイス登録を機に免税事業者から課税事業者になった方が対象です";
  else if (i.baseSales > 10_000_000) thirtyReason = "基準期間の課税売上高が1,000万円を超えるため対象外です";
  const thirty: MethodResult = {
    id: "thirty",
    name: "3割特例(売上税額の30%)",
    eligible: !thirtyReason,
    reason: thirtyReason,
    tax: thirtyReason ? null : floorYen(outTax * 0.3),
  };

  const methods = [standard, simplified, thirty];
  const ok = methods.filter((m) => m.eligible && m.tax !== null);
  const best = ok.length ? ok.reduce((a, b) => (b.tax! < a.tax! ? b : a)).id : null;

  if (i.purchases > i.sales) warnings.push("課税仕入高が課税売上高を上回っています。原則課税では還付になる可能性があります(簡易課税・3割特例では還付されません)。");
  if (i.baseSales > 10_000_000 && i.baseSales <= 50_000_000 && !i.wasExempt === false) {
    /* no-op: 既に3割特例の理由欄で表示 */
  }
  warnings.push("簡易課税は選択届出書の提出が必要で、原則として2年間は継続適用となります(やめる場合も届出が必要)。");
  warnings.push("設備投資など高額な仕入がある場合は、原則課税が有利になることがあります。本ツールでは考慮していません。");

  return { methods, best, breakEvenPurchaseRatio: 1 - ratio, warnings };
}

/** 簡易課税届出(2027年から適用)の期限までの残り日数。期限当日は0、超過は負。 */
export const SIMPLIFIED_DEADLINE = "2026-12-31";
export function daysUntil(deadline: string, now: Date): number {
  const [y, m, d] = deadline.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}
