/**
 * 取適法（中小受託取引適正化法）の適用目安判定。
 * 本ロジックは公開情報に基づく簡易判定であり、法的助言ではない。
 * 金額の単位は「万円」。
 */

export type TradeType =
  | 'manufacturing' // 製造委託
  | 'repair' // 修理委託
  | 'transport' // 特定運送委託
  | 'program' // 情報成果物作成委託（プログラム）
  | 'service_a' // 役務提供委託（運送・倉庫保管・情報処理）
  | 'info_other' // 情報成果物作成委託（プログラム以外：デザイン・映像・文章など）
  | 'service_b'; // 役務提供委託（上記以外）

export const TRADE_TYPES: { value: TradeType; label: string; example: string }[] = [
  { value: 'manufacturing', label: '製造委託', example: '部品・製品の製造や加工を委託' },
  { value: 'repair', label: '修理委託', example: '製品の修理を委託' },
  { value: 'transport', label: '特定運送委託', example: '荷主が運送事業者に運送を委託（2026年1月追加）' },
  { value: 'program', label: '情報成果物作成委託（プログラム）', example: 'ソフトウェア・アプリの開発を委託' },
  { value: 'service_a', label: '役務提供委託（運送・倉庫保管・情報処理）', example: '他人から請けた運送・保管・データ処理の再委託' },
  { value: 'info_other', label: '情報成果物作成委託（プログラム以外）', example: 'デザイン・動画・文章・設計図などの制作を委託' },
  { value: 'service_b', label: '役務提供委託（上記以外）', example: '他人から請けた役務（ビルメンテ等）の再委託' },
];

/** 資本金3億円／従業員300人の区分に属する取引類型か */
export function isGroupA(t: TradeType): boolean {
  return t === 'manufacturing' || t === 'repair' || t === 'transport' || t === 'program' || t === 'service_a';
}

export interface Party {
  /** 資本金（万円）。個人事業主・資本金なしは 0 */
  capital: number;
  /** 常時使用する従業員数（人） */
  employees: number;
}

export interface Judgement {
  status: 'applies' | 'not_applies' | 'unknown';
  basis: 'capital' | 'employees' | null;
  headline: string;
  reasons: string[];
  notes: string[];
}

const MAN = { m1000: 1000, m5000: 5000, b3: 30000 } as const;

export function judgeApplicability(type: TradeType, client: Party, contractor: Party): Judgement {
  const bad = [client.capital, client.employees, contractor.capital, contractor.employees].some(
    (v) => !Number.isFinite(v) || v < 0,
  );
  if (bad) {
    return {
      status: 'unknown',
      basis: null,
      headline: '入力値を確認してください',
      reasons: ['資本金・従業員数は0以上の数値で入力してください。'],
      notes: [],
    };
  }

  const A = isGroupA(type);
  const bigCap = A ? MAN.b3 : MAN.m5000;
  const empLimit = A ? 300 : 100;
  const bigLabel = A ? '3億円' : '5,000万円';

  const capitalHit =
    (client.capital > bigCap && contractor.capital <= bigCap) ||
    (client.capital > MAN.m1000 && client.capital <= bigCap && contractor.capital <= MAN.m1000);
  const employeeHit = client.employees > empLimit && contractor.employees <= empLimit;

  const notes: string[] = [
    '本判定は目安です。個別の取引が対象になるかは、公正取引委員会・中小企業庁の公式資料や専門家で確認してください。',
  ];
  if (contractor.employees === 0) {
    notes.push(
      '受注側に従業員がいない個人・一人法人の場合、取適法とは別に「フリーランス・事業者間取引適正化等法」の対象になる可能性があります（併せて確認を）。',
    );
  }

  if (capitalHit) {
    return {
      status: 'applies',
      basis: 'capital',
      headline: '取適法の対象となる可能性が高い（資本金基準）',
      reasons: [
        `取引類型「${TRADE_TYPES.find((t) => t.value === type)!.label}」は資本金${bigLabel}の区分で判定されます。`,
        `発注側の資本金 ${fmt(client.capital)} と受注側の資本金 ${fmt(contractor.capital)} の組み合わせが資本金基準に該当します。`,
      ],
      notes,
    };
  }
  if (employeeHit) {
    return {
      status: 'applies',
      basis: 'employees',
      headline: '取適法の対象となる可能性が高い（従業員基準）',
      reasons: [
        `資本金基準には該当しませんが、発注側の従業員 ${client.employees}人（${empLimit}人超）、受注側 ${contractor.employees}人（${empLimit}人以下）で従業員基準に該当します。`,
      ],
      notes,
    };
  }
  return {
    status: 'not_applies',
    basis: null,
    headline: '取適法の対象外となる可能性が高い',
    reasons: [
      `資本金基準（${bigLabel}区分）・従業員基準（${empLimit}人区分）のいずれにも該当しませんでした。`,
    ],
    notes: [...notes, '対象外でも、独占禁止法（優越的地位の濫用）等が問題になる場合があります。'],
  };
}

export function fmt(manYen: number): string {
  if (manYen === 0) return '0円（個人など）';
  if (manYen >= 10000) {
    const oku = Math.floor(manYen / 10000);
    const rest = manYen % 10000;
    return rest ? `${oku}億${rest.toLocaleString('ja-JP')}万円` : `${oku}億円`;
  }
  return `${manYen.toLocaleString('ja-JP')}万円`;
}
