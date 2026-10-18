// インボイス制度 経過措置: 適格請求書なしの仕入に係る仕入税額控除の割合。
// 法改正で変わり得るため、公開前に国税庁の最新資料で必ず確認すること（docs/PUBLISH.md 参照）。
export const RATES_VERIFIED = false;
export const RATES_SOURCE = 'https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice_about.htm';

export const RATE_PERIODS = [
  { from: '2023-10-01', to: '2026-09-30', rate: 0.8, label: '2023/10〜2026/9' },
  { from: '2026-10-01', to: '2028-09-30', rate: 0.7, label: '2026/10〜2028/9' },
  { from: '2028-10-01', to: '2030-09-30', rate: 0.5, label: '2028/10〜2030/9' },
  { from: '2030-10-01', to: '2031-09-30', rate: 0.3, label: '2030/10〜2031/9' },
];

// 少額特例: 税込1万円未満の課税仕入れは請求書なしでも全額控除（期限あり・要件あり）
export const SMALL_AMOUNT = { limit: 10000, until: '2029-09-30' };
