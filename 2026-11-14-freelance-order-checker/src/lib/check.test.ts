import { describe, it, expect } from 'vitest';
import { emptyForm, validate, parseDate, feeIsConcrete, judgeApplicability, buildOrderText, OrderForm } from './check';

const ok: OrderForm = {
  ...emptyForm, clientName: 'A社', freelancerName: '山田', orderDate: '2026-11-01',
  content: 'LP制作', deliveryDate: '2026-11-30', deliveryPlace: 'メール納品',
  fee: '100,000円', paymentDate: '2026-12-25',
};

describe('validate', () => {
  it('完全な入力はエラーなし', () => expect(validate(ok)).toEqual([]));
  it('空フォームは複数エラー', () => expect(validate(emptyForm).filter(f => f.severity === 'error').length).toBeGreaterThanOrEqual(7));
  it('60日超の支払期日はエラー', () => {
    const r = validate({ ...ok, paymentDate: '2027-02-15' });
    expect(r.some(f => f.field === 'paymentDate' && f.severity === 'error')).toBe(true);
  });
  it('ちょうど60日は許容', () => expect(validate({ ...ok, deliveryDate: '2026-11-30', paymentDate: '2027-01-29' })).toEqual([]));
  it('不正な日付', () => expect(validate({ ...ok, paymentDate: '2026-02-30' }).some(f => f.field === 'paymentDate')).toBe(true));
  it('検査ありで検査日なしはエラー', () => expect(validate({ ...ok, inspection: 'yes' }).some(f => f.field === 'inspectionDate')).toBe(true));
  it('現金以外で支払方法なしはエラー', () => expect(validate({ ...ok, paymentIsCash: false }).some(f => f.field === 'paymentMethod')).toBe(true));
  it('曖昧な報酬はエラー', () => expect(validate({ ...ok, fee: '応相談' }).some(f => f.field === 'fee')).toBe(true));
});
describe('helpers', () => {
  it('parseDate', () => { expect(parseDate('2026-11-14')).not.toBeNull(); expect(parseDate('2026-13-01')).toBeNull(); expect(parseDate('abc')).toBeNull(); });
  it('feeIsConcrete', () => { expect(feeIsConcrete('時給3000円×40時間')).toBe(true); expect(feeIsConcrete('別途協議')).toBe(false); expect(feeIsConcrete('')).toBe(false); });
  it('judgeApplicability', () => {
    expect(judgeApplicability({ clientHasEmployees: true, freelancerHasEmployees: false, isBusinessToBusiness: true }).result).toBe('applies');
    expect(judgeApplicability({ clientHasEmployees: true, freelancerHasEmployees: true, isBusinessToBusiness: true }).result).toBe('not-applies');
    expect(judgeApplicability({ clientHasEmployees: null, freelancerHasEmployees: null, isBusinessToBusiness: null }).result).toBe('unknown');
  });
  it('buildOrderText', () => expect(buildOrderText(ok)).toContain('支払期日: 2026-12-25'));
});
describe('edge cases (debug round 2)', () => {
  it('うるう日を許容', () => expect(parseDate('2028-02-29')).not.toBeNull());
  it('平年の2/29は不正', () => expect(parseDate('2027-02-29')).toBeNull());
  it('納期が発注日より前なら警告', () => expect(validate({ ...ok, deliveryDate: '2026-10-01', paymentDate: '2026-11-20' }).some(f => f.field === 'deliveryDate' && f.severity === 'warn')).toBe(true));
  it('従業員なしの発注側は第4条対象外の注記', () => expect(judgeApplicability({ clientHasEmployees: false, freelancerHasEmployees: false, isBusinessToBusiness: true }).note).toContain('第4条'));
});
