import { describe, it, expect } from 'vitest';
import { judgeApplicability } from '../src/lib/applicability';
import { checkPayment, paymentDeadline, formatDate, worstCaseDays, parseDate } from '../src/lib/payment';
import { summarize } from '../src/lib/checklist';

const P = (capital: number, employees: number) => ({ capital, employees });

describe('applicability', () => {
  it('program: 発注1億/受注個人 → 資本金基準', () => {
    const j = judgeApplicability('program', P(10000, 50), P(0, 1));
    expect(j.status).toBe('applies');
    expect(j.basis).toBe('capital');
  });
  it('program: 発注1億/受注2000万 → 資本金基準は非該当', () => {
    const j = judgeApplicability('program', P(10000, 50), P(2000, 5));
    expect(j.status).toBe('not_applies');
  });
  it('program: 発注4億/受注3億 → 該当', () => {
    expect(judgeApplicability('program', P(40000, 10), P(30000, 10)).status).toBe('applies');
  });
  it('info_other: 発注6000万/受注5000万 → 該当、3億区分なら非該当', () => {
    expect(judgeApplicability('info_other', P(6000, 10), P(5000, 10)).status).toBe('applies');
    expect(judgeApplicability('program', P(6000, 10), P(5000, 10)).status).toBe('not_applies');
  });
  it('従業員基準: 資本金非該当でも従業員で該当', () => {
    const j = judgeApplicability('service_b', P(3000, 150), P(3000, 80));
    expect(j.status).toBe('applies');
    expect(j.basis).toBe('employees');
  });
  it('境界: 発注資本金ちょうど1000万は資本金基準に入らない', () => {
    expect(judgeApplicability('info_other', P(1000, 10), P(0, 0)).status).toBe('not_applies');
    expect(judgeApplicability('info_other', P(1001, 10), P(0, 0)).status).toBe('applies');
  });
  it('不正値は unknown', () => {
    expect(judgeApplicability('program', P(NaN, 1), P(0, 1)).status).toBe('unknown');
    expect(judgeApplicability('program', P(-1, 1), P(0, 1)).status).toBe('unknown');
  });
  it('従業員0の受注側にはフリーランス法の注記', () => {
    const j = judgeApplicability('program', P(10000, 50), P(0, 0));
    expect(j.notes.some((n) => n.includes('フリーランス'))).toBe(true);
  });
});

describe('payment', () => {
  it('60日目は受領日+59日', () => {
    expect(formatDate(paymentDeadline('2026-11-01')!)).toBe('2026-12-30（水）');
  });
  it('期限内/超過の判定', () => {
    expect(checkPayment('2026-11-01', '2026-12-30')!.ok).toBe(true);
    const ng = checkPayment('2026-11-01', '2026-12-31')!;
    expect(ng.ok).toBe(false);
    expect(ng.days).toBe(61);
  });
  it('不正な日付はnull', () => {
    expect(parseDate('2026-02-30')).toBeNull();
    expect(checkPayment('abc', '2026-01-01')).toBeNull();
  });
  it('支払日が受領日より前', () => {
    expect(checkPayment('2026-11-10', '2026-11-01')!.ok).toBe(false);
  });
  it('月末締め翌月末払いは最大61日 → 超過', () => {
    const r = worstCaseDays({ closingDay: 0, monthsLater: 1, payDay: 0 });
    expect(r.worstDays).toBeGreaterThan(60);
    expect(r.ok).toBe(false);
  });
  it('月末締め翌月15日払いは60日以内', () => {
    expect(worstCaseDays({ closingDay: 0, monthsLater: 1, payDay: 15 }).ok).toBe(true);
  });
  it('20日締め翌月20日払いは、12月21日受領→2月20日払いで62日となり超過', () => {
    const r = worstCaseDays({ closingDay: 20, monthsLater: 1, payDay: 20 });
    expect(r.worstDays).toBe(62);
    expect(r.ok).toBe(false);
  });
  it('20日締め翌月15日払いは60日以内', () => {
    expect(worstCaseDays({ closingDay: 20, monthsLater: 1, payDay: 15 }).ok).toBe(true);
  });
});

describe('checklist', () => {
  it('はい/いいえに応じてリスク集計', () => {
    const s = summarize({ fee: 'yes', late: 'no', written: 'no' });
    expect(s.risky.map((r) => r.id).sort()).toEqual(['fee', 'written']);
    expect(s.answered).toBe(3);
  });
});
