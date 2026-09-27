import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildYearCalendar, findBridgeGaps, recommendPlan, isWeekend } from '../src/planner.js';
import { HOLIDAYS } from '../src/holidays.js';

test('isWeekend detects Saturday/Sunday', () => {
  assert.equal(isWeekend(new Date(2026, 0, 3)), true); // Sat
  assert.equal(isWeekend(new Date(2026, 0, 4)), true); // Sun
  assert.equal(isWeekend(new Date(2026, 0, 5)), false); // Mon
});

test('buildYearCalendar covers every day of the year and marks holidays as off', () => {
  const calendar = buildYearCalendar(2026, HOLIDAYS[2026]);
  assert.equal(calendar.length, 365); // 2026 is not a leap year
  const newYear = calendar.find((d) => d.iso === '2026-01-01');
  assert.equal(newYear.isOff, true);
  assert.equal(newYear.label, '元日');
});

test('buildYearCalendar handles leap year length', () => {
  // 2028 is a leap year, used only to sanity-check day counting logic
  const calendar = buildYearCalendar(2028, []);
  assert.equal(calendar.length, 366);
});

test('findBridgeGaps finds the single-workday bridge around Kenkoku Kinen no Hi 2026 (Wed 2/11)', () => {
  const calendar = buildYearCalendar(2026, HOLIDAYS[2026]);
  const gaps = findBridgeGaps(calendar, 5);
  // 2/11 (Wed) is a holiday; 2/9 (Mon) and 2/10 (Tue) are workdays between
  // the weekend (2/7-2/8) and the holiday, and 2/12-2/13 workdays before the next weekend.
  const gapBefore = gaps.find((g) => g.startDate === '2026-02-09' && g.endDate === '2026-02-10');
  assert.ok(gapBefore, 'expected a 2-day gap 2026-02-09..02-10');
  assert.equal(gapBefore.beforeStreak, 2); // Sat+Sun
  assert.equal(gapBefore.afterStreak, 1); // 2/11 holiday only (2/12 is a workday)
  assert.equal(gapBefore.totalStreak, 5);
});

test('recommendPlan stays within the leave budget', () => {
  const result = recommendPlan(2026, HOLIDAYS[2026], 5);
  const totalGapLenUsed = result.plan.reduce((sum, g) => sum + g.gapLen, 0);
  assert.ok(totalGapLenUsed <= 5);
  assert.equal(result.leaveUsed, totalGapLenUsed);
  assert.equal(result.leaveUsed + result.leaveRemaining, 5);
});

test('recommendPlan picks higher-efficiency gaps first', () => {
  const result = recommendPlan(2026, HOLIDAYS[2026], 2);
  // With only 2 days of budget, the plan (if any picked) must be the best-efficiency
  // gap(s) available with gapLen <= 2.
  const affordable = result.allGaps.filter((g) => g.gapLen > 0 && g.gapLen <= 2);
  if (affordable.length > 0) {
    const best = affordable[0];
    assert.ok(result.plan.some((g) => g.startDate === best.startDate));
  }
});

test('recommendPlan throws on invalid budget', () => {
  assert.throws(() => recommendPlan(2026, HOLIDAYS[2026], -1));
});

test('recommendPlan with zero budget returns an empty plan', () => {
  const result = recommendPlan(2026, HOLIDAYS[2026], 0);
  assert.deepEqual(result.plan, []);
  assert.equal(result.totalDaysOffGained, 0);
});
