// 有給休暇の最適配置プランナー コアロジック
// DOM に依存しないため Node (テスト) とブラウザの両方から import できる。

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 指定年の1/1〜12/31を1日ずつたどり、休み/平日の配列を作る。
 * @param {number} year
 * @param {{date: string, name: string}[]} holidayList
 */
export function buildYearCalendar(year, holidayList) {
  const holidayMap = new Map(holidayList.map((h) => [h.date, h.name]));
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const days = [];
  for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
    const date = new Date(t);
    const iso = toISODate(date);
    const holidayName = holidayMap.get(iso);
    days.push({
      date,
      iso,
      isOff: isWeekend(date) || Boolean(holidayName),
      label: holidayName || (isWeekend(date) ? '週末' : ''),
    });
  }
  return days;
}

/**
 * 平日が連続しているブロック（=有給休暇で埋めれば連休になる区間）を検出する。
 * @param {ReturnType<typeof buildYearCalendar>} calendar
 * @param {number} maxGapLen ブロックの最大日数（デフォルト5=1週間分まで）
 */
export function findBridgeGaps(calendar, maxGapLen = 5) {
  const gaps = [];
  let i = 0;
  while (i < calendar.length) {
    if (calendar[i].isOff) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < calendar.length && !calendar[i].isOff) i += 1;
    const gapLen = i - start;

    if (gapLen <= maxGapLen) {
      let before = 0;
      for (let j = start - 1; j >= 0 && calendar[j].isOff; j -= 1) before += 1;
      let after = 0;
      for (let j = i; j < calendar.length && calendar[j].isOff; j += 1) after += 1;

      // 年の境界に接するブロックは前後が確定しないため保守的に0扱い（境界を跨いだ休みは翌/前年の祝日データが無いと数えられない）
      const totalStreak = before + gapLen + after;
      gaps.push({
        startIndex: start,
        endIndex: i - 1,
        startDate: calendar[start].iso,
        endDate: calendar[i - 1].iso,
        gapLen,
        beforeStreak: before,
        afterStreak: after,
        totalStreak,
        efficiency: totalStreak / gapLen,
      });
    }
    i += 1;
  }
  return gaps;
}

/**
 * 与えられた有給休暇の残日数（leaveBudget）を、最も効率の良いブロックから
 * 貪欲法で割り当てるプランを作る。
 */
export function recommendPlan(year, holidayList, leaveBudget, maxGapLen = 5) {
  if (leaveBudget < 0 || !Number.isFinite(leaveBudget)) {
    throw new Error('leaveBudget must be a non-negative number');
  }
  const calendar = buildYearCalendar(year, holidayList);
  const gaps = findBridgeGaps(calendar, maxGapLen);

  const ranked = [...gaps].sort((a, b) => {
    if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
    return b.totalStreak - a.totalStreak;
  });

  let remaining = leaveBudget;
  const plan = [];
  for (const gap of ranked) {
    if (gap.gapLen === 0) continue;
    if (gap.gapLen <= remaining) {
      plan.push(gap);
      remaining -= gap.gapLen;
    }
    if (remaining === 0) break;
  }

  plan.sort((a, b) => a.startIndex - b.startIndex);

  const leaveUsed = leaveBudget - remaining;
  const totalDaysOffGained = plan.reduce((sum, g) => sum + g.totalStreak, 0);

  return {
    year,
    leaveBudget,
    leaveUsed,
    leaveRemaining: remaining,
    plan,
    totalDaysOffGained,
    allGaps: ranked,
  };
}

export { isWeekend, toISODate, parseISODate };
