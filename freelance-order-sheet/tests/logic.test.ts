import { describe, it, expect } from 'vitest';
import { validate, emptyForm, parseAmount, maxDueDate, render, daysBetween, parseDate, OrderForm } from '../src/logic';

const ok: OrderForm = { ...emptyForm, clientName: 'A社', freelancerName: '山田', orderDate: '2026-11-01',
  description: 'ロゴ制作', deliveryDate: '2026-11-30', deliveryPlace: 'メール納品', amount: '100,000', dueDate: '2026-12-31' };

describe('logic', () => {
  it('valid form has no issues', () => expect(validate(ok)).toEqual([]));
  it('empty form has errors', () => expect(validate(emptyForm).filter(i => i.level === 'error').length).toBeGreaterThan(5));
  it('parseAmount handles formats', () => {
    expect(parseAmount('１２,３４５円')).toBe(12345);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
  });
  it('rejects impossible dates', () => { expect(parseDate('2026-02-30')).toBeNull(); expect(daysBetween('x', '2026-01-01')).toBeNull(); });
  it('60 day limit', () => {
    expect(maxDueDate('2026-11-30')).toBe('2027-01-28');
    expect(validate({ ...ok, dueDate: '2027-01-29' }).some(i => i.message.includes('60日'))).toBe(true);
    expect(validate({ ...ok, dueDate: '2027-01-28' })).toEqual([]);
  });
  it('amount note can replace amount', () => {
    expect(validate({ ...ok, amount: '', amountNote: '時給3,000円×稼働時間' })).toEqual([]);
  });
  it('tax mode shown', () => expect(render({ ...ok, taxMode: '税別' })).toContain('100,000円(税別)'));
  it('render includes key items and omits optional', () => {
    const t = render(ok);
    expect(t).toContain('100,000円');
    expect(t).toContain('2026年12月31日');
    expect(t).not.toContain('検査完了日');
    expect(render({ ...ok, inspectionDate: '2026-12-05' })).toContain('検査完了日');
  });
});
