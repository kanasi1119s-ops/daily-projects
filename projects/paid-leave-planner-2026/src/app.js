import { recommendPlan } from './planner.js';
import { HOLIDAYS } from './holidays.js';

const yearSelect = document.getElementById('year');
const budgetInput = document.getElementById('budget');
const maxGapInput = document.getElementById('maxGap');
const calcButton = document.getElementById('calc');
const summaryEl = document.getElementById('summary');
const planEl = document.getElementById('plan-output');
const gapsTableBody = document.querySelector('#gaps-table tbody');

function formatDateRange(startISO, endISO) {
  if (startISO === endISO) return startISO;
  return `${startISO} 〜 ${endISO}`;
}

function render(result) {
  summaryEl.innerHTML = `
    <div class="stat-row">
      <div class="stat-card">
        <div class="value">${result.leaveUsed}日</div>
        <div class="label">使う有給休暇</div>
      </div>
      <div class="stat-card">
        <div class="value">${result.totalDaysOffGained}日</div>
        <div class="label">実際に休める日数（合計）</div>
      </div>
      <div class="stat-card">
        <div class="value">${result.leaveRemaining}日</div>
        <div class="label">残る有給休暇</div>
      </div>
    </div>
  `;

  if (result.plan.length === 0) {
    planEl.innerHTML = '<p class="empty-state">条件に合うプランが見つかりませんでした。有給日数や最大日数を増やしてみてください。</p>';
  } else {
    planEl.innerHTML =
      '<h2>おすすめの有給取得プラン</h2>' +
      result.plan
        .map(
          (g) => `
        <div class="plan-card">
          <div class="period">${formatDateRange(g.startDate, g.endDate)} に有給を取得</div>
          <div class="detail">有給 ${g.gapLen}日 使用 → 合計 ${g.totalStreak}日の連休（前後の休み: ${g.beforeStreak}日 + ${g.afterStreak}日）</div>
        </div>
      `
        )
        .join('');
  }

  const usedKeys = new Set(result.plan.map((g) => g.startDate));
  gapsTableBody.innerHTML = result.allGaps
    .filter((g) => g.gapLen > 0)
    .map(
      (g) => `
      <tr class="${usedKeys.has(g.startDate) ? 'used' : ''}">
        <td>${formatDateRange(g.startDate, g.endDate)}</td>
        <td>${g.gapLen}日</td>
        <td>${g.totalStreak}日</td>
        <td>${g.efficiency.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');
}

function runCalculation() {
  const year = Number(yearSelect.value);
  const budget = Math.max(0, Number(budgetInput.value) || 0);
  const maxGap = Math.max(1, Number(maxGapInput.value) || 5);
  const result = recommendPlan(year, HOLIDAYS[year], budget, maxGap);
  render(result);
}

calcButton.addEventListener('click', runCalculation);
window.addEventListener('DOMContentLoaded', runCalculation);
// index.html loads this as a module after the DOM is already parsed in most cases,
// so also run once immediately in case DOMContentLoaded already fired.
runCalculation();
