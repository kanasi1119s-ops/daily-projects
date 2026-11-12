import { describe, it, expect } from 'vitest';
import { normalizeDate, normalizeAmount, buildFileName, dedupe, sanitize } from '../src/naming';
import { toCsv } from '../src/csv';
import { makeZip, crc32 } from '../src/zip';

describe('normalizeDate', () => {
  it('accepts common formats', () => {
    expect(normalizeDate('2026-11-12')).toBe('20261112');
    expect(normalizeDate('2026/1/5')).toBe('20260105');
    expect(normalizeDate('２０２６年１１月１２日')).toBe('20261112');
    expect(normalizeDate('20261112')).toBe('20261112');
    expect(normalizeDate('令和8年11月12日')).toBe('20261112');
    expect(normalizeDate('R元.5.1')).toBe('20190501');
  });
  it('rejects invalid', () => {
    expect(normalizeDate('2026-02-30')).toBeNull();
    expect(normalizeDate('abc')).toBeNull();
    expect(normalizeDate('')).toBeNull();
  });
});
describe('normalizeAmount', () => {
  it('normalizes', () => {
    expect(normalizeAmount('¥110,000')).toBe('110000');
    expect(normalizeAmount('１２３４円')).toBe('1234');
    expect(normalizeAmount('0')).toBe('0');
  });
  it('rejects', () => {
    expect(normalizeAmount('12.5')).toBeNull();
    expect(normalizeAmount('-5')).toBeNull();
    expect(normalizeAmount('')).toBeNull();
  });
});
describe('buildFileName', () => {
  const e = { originalName: 'scan.PDF', date: '2026-11-12', docType: '請求書', vendor: '株式会社/テスト', amount: '110,000' };
  it('builds default', () => {
    expect(buildFileName(e).name).toBe('20261112_請求書_株式会社テスト_110000円.pdf');
  });
  it('handles empty type', () => {
    expect(buildFileName({ ...e, docType: '' }).name).toBe('20261112_株式会社テスト_110000円.pdf');
  });
  it('reports errors', () => {
    expect(buildFileName({ ...e, vendor: '' }).errors).toContain('取引先が未入力です');
  });
  it('strips path traversal', () => {
    expect(sanitize('../../etc')).toBe('etc');
    expect(buildFileName({ ...e, vendor: '..\\..\\x' }).name).toBe('20261112_請求書_x_110000円.pdf');
  });
});
describe('dedupe', () => {
  it('suffixes duplicates', () => {
    expect(dedupe(['a.pdf', 'a.pdf', 'A.pdf', 'a_2.pdf'])).toEqual(['a.pdf', 'a_3.pdf', 'A_4.pdf', 'a_2.pdf']);
  });
});
describe('csv', () => {
  it('escapes and guards formulas', () => {
    const c = toCsv([['=1+1', 'a"b']]);
    expect(c).toBe('﻿"\'=1+1","a""b"\r\n');
  });
});
describe('zip', () => {
  it('crc32 known value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('has valid structure', () => {
    const z = makeZip([{ name: 'あ.txt', data: new TextEncoder().encode('hi') }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(z.length - 22 + 10, true)).toBe(1);
  });
});
