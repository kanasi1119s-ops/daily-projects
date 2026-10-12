import { describe, expect, it } from 'vitest';
import { buildNoticeText, calcPaymentLimit, emptyInput, parseAmount, parseDate, validate } from './notice';

const ok = () => ({
  ...emptyInput(),
  clientName: '株式会社A',
  freelancerName: '山田太郎',
  orderDate: '2026-10-01',
  description: 'LP制作',
  deliveryDate: '2026-10-31',
  deliveryPlace: 'メール納品',
  feeAmount: '100,000',
  paymentDate: '2026-11-30',
});

describe('date', () => {
  it('rejects impossible dates', () => {
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2026-2-3')).toBeNull();
    expect(parseDate('2026-02-28')).not.toBeNull();
  });
});

describe('calcPaymentLimit', () => {
  it('60 days from delivery', () => expect(calcPaymentLimit('2026-10-31', false, false)).toBe('2026-12-30'));
  it('30 days for subcontract', () => expect(calcPaymentLimit('2026-10-31', true, false)).toBe('2026-11-30'));
  it('monthly closing uses month end', () => expect(calcPaymentLimit('2026-10-05', false, true)).toBe('2026-12-30'));
  it('invalid date', () => expect(calcPaymentLimit('', false, false)).toBeNull());
});

describe('parseAmount', () => {
  it('parses formatted', () => expect(parseAmount('¥1,000円')).toBe(1000));
  it('accepts full-width digits', () => expect(parseAmount('１００，０００')).toBe(100000));
  it('rejects decimals/negatives/empty', () => {
    expect(parseAmount('1.5')).toBeNull();
    expect(parseAmount('-1')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});

describe('validate', () => {
  it('valid input has no issues', () => expect(validate(ok())).toEqual([]));
  it('empty input flags required fields', () => {
    const f = validate(emptyInput()).map((x) => x.field);
    expect(f).toEqual(expect.arrayContaining(['clientName', 'freelancerName', 'description', 'orderDate', 'deliveryDate', 'feeAmount', 'paymentDate']));
  });
  it('payment over 60 days is error', () => {
    const r = validate({ ...ok(), paymentDate: '2026-12-31' });
    expect(r.some((x) => x.field === 'paymentDate' && x.severity === 'error')).toBe(true);
  });
  it('payment exactly at limit is ok', () => expect(validate({ ...ok(), paymentDate: '2026-12-30' })).toEqual([]));
  it('subcontract limit 30 days', () => {
    expect(validate({ ...ok(), isSubcontract: true, paymentDate: '2026-12-01' }).some((x) => x.field === 'paymentDate')).toBe(true);
    expect(validate({ ...ok(), isSubcontract: true })).toEqual([]);
  });
  it('inspection requires date', () => {
    expect(validate({ ...ok(), hasInspection: true }).some((x) => x.field === 'inspectionDate')).toBe(true);
  });
  it('formula fee requires formula', () => {
    expect(validate({ ...ok(), feeType: 'formula' }).some((x) => x.field === 'feeFormula')).toBe(true);
  });
  it('non-bank payment requires note', () => {
    expect(validate({ ...ok(), paymentMethod: 'other' }).some((x) => x.field === 'paymentMethodNote')).toBe(true);
  });
});

describe('buildNoticeText', () => {
  it('contains key items', () => {
    const t = buildNoticeText(ok());
    expect(t).toContain('100,000円（消費税別）');
    expect(t).toContain('2026年11月30日');
  });
});
