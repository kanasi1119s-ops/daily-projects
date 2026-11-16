import { describe, it, expect } from 'vitest';
import { summarize, deadlines, todos, warnings, toCSV, parseImport, sanitizeAmount, daysBetween, type Donation } from '../src/logic';

const d = (o: Partial<Donation> = {}): Donation => ({ id: 'a', date: '2026-11-16', municipality: '北海道A町', amount: 10000, item: '米', method: 'onestop', paid: true, receiptReceived: false, onestopSent: false, ...o });

describe('logic', () => {
  it('summarize totals and remaining', () => {
    const s = summarize([d(), d({ id: 'b', amount: 5000, paid: false })], 30000);
    expect(s.total).toBe(15000); expect(s.paidTotal).toBe(10000); expect(s.unpaidTotal).toBe(5000);
    expect(s.remaining).toBe(15000); expect(s.overLimit).toBe(false); expect(s.estimatedSelfBurden).toBe(2000);
  });
  it('over limit', () => { expect(summarize([d()], 5000).overLimit).toBe(true); });
  it('no limit set is not over', () => { expect(summarize([d()], 0).overLimit).toBe(false); });
  it('small donation burden capped', () => { expect(summarize([d({ amount: 1500 })], 0).estimatedSelfBurden).toBe(1500); });
  it('counts municipalities normalized', () => {
    const s = summarize([d({ municipality: 'Ａ 町' }), d({ id: 'b', municipality: 'A町' })], 0);
    expect(s.municipalityCount).toBe(1);
  });
  it('onestop >5', () => {
    const l = 'ABCDEF'.split('').map((c) => d({ id: c, municipality: c }));
    expect(summarize(l, 0).onestopOverFive).toBe(true);
    expect(summarize(l.slice(0, 5), 0).onestopOverFive).toBe(false);
  });
  it('deadlines', () => {
    const x = deadlines('2026-11-16');
    expect(x.daysToPayment).toBe(45); expect(x.onestopDeadline).toBe('2027-01-10'); expect(x.daysToOnestop).toBe(55);
    expect(daysBetween('2026-12-31', '2026-12-31')).toBe(0);
  });
  it('january refers to previous year donations', () => {
    const x = deadlines('2027-01-05');
    expect(x.year).toBe(2026); expect(x.daysToOnestop).toBe(5); expect(x.daysToPayment).toBeLessThan(0);
  });
  it('todos', () => {
    const t = todos([d({ paid: false }), d({ id: 'k', method: 'kakutei' })]);
    expect(t.map((x) => x.id)).toEqual(['a:pay', 'a:os', 'k:rc']);
  });
  it('warnings mixed + duplicate', () => {
    const l = [d(), d({ id: 'k', method: 'kakutei' })];
    const w = warnings(l, summarize(l, 100000));
    expect(w.some((x) => x.includes('無効'))).toBe(true); expect(w.some((x) => x.includes('重複'))).toBe(true);
  });
  it('csv escapes formulas and quotes', () => {
    const c = toCSV([d({ municipality: '=cmd', item: 'a"b' })]);
    expect(c).toContain('"\'=cmd"'); expect(c).toContain('"a""b"');
  });
  it('sanitizeAmount', () => {
    expect(sanitizeAmount('１０，０００円')).toBe(10000); expect(sanitizeAmount('-5')).toBe(0); expect(sanitizeAmount('abc')).toBe(0); expect(sanitizeAmount(12.9)).toBe(12);
  });
  it('amount capped', () => { expect(sanitizeAmount('9999999999999999999')).toBe(100000000); });
  it('parseImport', () => {
    const r = parseImport(JSON.stringify({ donations: [{ municipality: 'X', amount: '3000', date: 'bad', method: 'zzz' }] }));
    expect(r[0].amount).toBe(3000); expect(r[0].date).toBe(''); expect(r[0].method).toBe('onestop');
    expect(() => parseImport('{}')).toThrow();
  });
});
