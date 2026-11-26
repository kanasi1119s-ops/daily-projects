// 制度パラメータ。★公開前に国税庁の一次情報で要確認（令和8年度税制改正反映の想定値）
export const RULES = {
  taxRate: 0.10,
  // 簡易課税のみなし仕入率（事業区分）
  deemed: {
    1: { label: '第1種 卸売業', rate: 0.9 },
    2: { label: '第2種 小売業・農林水産業(飲食料品)', rate: 0.8 },
    3: { label: '第3種 製造業・建設業等', rate: 0.7 },
    4: { label: '第4種 飲食店業等', rate: 0.6 },
    5: { label: '第5種 サービス業・運輸通信業等', rate: 0.5 },
    6: { label: '第6種 不動産業', rate: 0.4 },
  },
  simplifiedLimit: 50_000_000, // 簡易課税: 基準期間の課税売上高上限
  smallLimit: 10_000_000,      // 2割/3割特例: 基準期間の課税売上高上限
  twentyPercent: { rate: 0.2, lastYear: 2026 },            // 個人: 令和8年分まで
  thirtyPercent: { rate: 0.3, years: [2027, 2028] },       // 個人のみ 令和9・10年分
};
