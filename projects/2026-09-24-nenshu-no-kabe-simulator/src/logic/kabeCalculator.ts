// 「年収の壁」計算ロジック（2026年10月制度改正後をベースにした概算シミュレーション）
// 出典: 2025-2026年の税制改正・年金制度改正の公開情報をもとにした一般的な目安値。
// 個々の状況（自治体・企業規模・保険組合等）で結果は変わるため、必ず注意書きを表示する。

export type EmployerSize = 'under100' | 'over100'

export interface KabeInput {
  annualIncome: number // 想定年収（万円）
  isStudent: boolean // 学生（勤労学生控除の対象を想定）かどうか
  employerSize: EmployerSize // 勤務先の従業員規模
}

export interface KabeLine {
  key: string
  label: string
  thresholdManYen: number
  status: 'clear' | 'near' | 'over'
  description: string
}

const NEAR_MARGIN_MANYEN = 10

function statusFor(income: number, threshold: number): KabeLine['status'] {
  if (income < threshold - NEAR_MARGIN_MANYEN) return 'clear'
  if (income <= threshold) return 'near'
  return 'over'
}

export function calculateKabeLines(input: KabeInput): KabeLine[] {
  const { annualIncome, isStudent, employerSize } = input

  const lines: KabeLine[] = []

  // 所得税がかかり始めるライン（2026年基準の目安）
  const incomeTaxThreshold = isStudent ? 150 : 123
  lines.push({
    key: 'income-tax',
    label: isStudent ? '150万円の壁（勤労学生・所得税）' : '123万円の壁（所得税の課税ライン）',
    thresholdManYen: incomeTaxThreshold,
    status: statusFor(annualIncome, incomeTaxThreshold),
    description: 'この額を超えると本人に所得税がかかり始める目安ラインです。',
  })

  // 扶養控除（親・配偶者の税金）に影響するライン
  lines.push({
    key: 'dependent-deduction',
    label: '178万円の壁（扶養控除・配偶者控除の上限目安）',
    thresholdManYen: 178,
    status: statusFor(annualIncome, 178),
    description: '扶養している家族の税負担に影響する上限の目安ラインです（段階的な改正が進行中）。',
  })

  // 社会保険（旧106万円の壁）: 2026年10月に賃金要件が撤廃される想定
  if (employerSize === 'over100') {
    lines.push({
      key: 'social-insurance-106',
      label: '106万円の壁（2026年10月に賃金要件は撤廃予定）',
      thresholdManYen: 106,
      status: statusFor(annualIncome, 106),
      description:
        '2026年10月以降は賃金要件が撤廃される見込みのため、勤務時間などの他要件で判定が変わります。最新情報を確認してください。',
    })
  }

  // 130万円の壁（社会保険の扶養）: 2026年10月に賃金要件が撤廃される想定
  lines.push({
    key: 'social-insurance-130',
    label: '130万円の壁（社会保険の扶養）',
    thresholdManYen: 130,
    status: statusFor(annualIncome, 130),
    description:
      '超えると自分で社会保険料を負担する可能性があります。2026年10月に賃金要件（月8.8万円）が撤廃予定です。',
  })

  // 配偶者特別控除が満額になる上限の目安
  lines.push({
    key: 'spouse-special-deduction',
    label: '169万円の壁（配偶者特別控除の満額上限の目安）',
    thresholdManYen: 169,
    status: statusFor(annualIncome, 169),
    description: 'これを超えると配偶者特別控除が段階的に縮小していく目安ラインです。',
  })

  return lines.sort((a, b) => a.thresholdManYen - b.thresholdManYen)
}

export function summarize(lines: KabeLine[]): string {
  const overCount = lines.filter((l) => l.status === 'over').length
  const nearCount = lines.filter((l) => l.status === 'near').length
  if (overCount === 0 && nearCount === 0) {
    return 'すべての壁より余裕があります。'
  }
  if (overCount > 0) {
    return `${overCount}件の壁をすでに超えています。手取りや扶養への影響を確認しましょう。`
  }
  return `${nearCount}件の壁に近づいています。働き方の調整を検討するタイミングかもしれません。`
}
