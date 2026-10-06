/**
 * 免税事業者等（インボイス発行事業者以外）からの課税仕入れに係る経過措置の控除割合。
 * 令和8年度税制改正後のスケジュール。公開前に国税庁の最新情報で必ず再確認すること。
 * 日付は ISO 形式 (YYYY-MM-DD) の文字列比較で判定する。
 */
export interface Period {
  from: string; // inclusive
  to: string; // inclusive
  ratio: number; // 0..1
  label: string;
}

export const SCHEDULE: readonly Period[] = [
  { from: "2023-10-01", to: "2026-09-30", ratio: 0.8, label: "80%（令和5年10月〜令和8年9月）" },
  { from: "2026-10-01", to: "2028-09-30", ratio: 0.7, label: "70%（令和8年10月〜令和10年9月）" },
  { from: "2028-10-01", to: "2030-09-30", ratio: 0.5, label: "50%（令和10年10月〜令和12年9月）" },
  { from: "2030-10-01", to: "2031-09-30", ratio: 0.3, label: "30%（令和12年10月〜令和13年9月）" },
];

export const SYSTEM_START = "2023-10-01";
export const SCHEDULE_END = "2031-09-30";
/** 1事業年度（課税期間）あたりの適用上限（税込・インボイス発行事業者以外からの課税仕入れ合計） */
export const ANNUAL_CAP_YEN = 100_000_000;

export interface RatioResult {
  ratio: number;
  label: string;
}

export function ratioFor(date: string): RatioResult {
  if (date < SYSTEM_START) return { ratio: 1, label: "100%（インボイス制度開始前）" };
  if (date > SCHEDULE_END) return { ratio: 0, label: "0%（経過措置終了後）" };
  const p = SCHEDULE.find((s) => date >= s.from && date <= s.to);
  // SCHEDULE は期間が連続しているため到達しないが、型安全のため
  return p ? { ratio: p.ratio, label: p.label } : { ratio: 0, label: "0%" };
}
