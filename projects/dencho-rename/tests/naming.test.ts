import { describe, it, expect } from 'vitest';
import { buildName, buildAll, buildIndexCsv, parseAmount, isValidDate, guessFromFilename, defaultOptions } from '../src/naming';

const e = (o: Partial<Parameters<typeof buildName>[0]> = {}) => ({ original: 'a.PDF', date: '2026-11-09', partner: '株式会社テスト', amount: '110,000', ...o });

describe('naming', () => {
  it('基本形', () => expect(buildName(e())).toBe('20261109_株式会社テスト_110000.pdf'));
  it('日付ハイフン・区切り変更', () =>
    expect(buildName(e(), { ...defaultOptions, compactDate: false, separator: '-' })).toBe('2026-11-09-株式会社テスト-110000.pdf'));
  it('禁止文字除去・全角→半角', () => expect(buildName(e({ partner: 'A/B:C？Ｄ' }))).toBe('20261109_ABC？D_110000.pdf'.replace('？', '')));
  it('不正日付', () => { expect(isValidDate('2026-02-30')).toBe(false); expect(buildName(e({ date: '2026-02-30' }))).toBeNull(); });
  it('金額パース', () => { expect(parseAmount('¥１，２３４円')).toBe(1234); expect(parseAmount('-1')).toBeNull(); expect(parseAmount('1.5')).toBeNull(); expect(parseAmount('')).toBeNull(); });
  it('重複に連番', () => expect(buildAll([e(), e(), e()])).toEqual(['20261109_株式会社テスト_110000.pdf', '20261109_株式会社テスト_110000_2.pdf', '20261109_株式会社テスト_110000_3.pdf']));
  it('メモ', () => expect(buildName(e({ note: '請求書' }), { ...defaultOptions, includeNote: true })).toBe('20261109_株式会社テスト_110000_請求書.pdf'));
  it('CSVインジェクション対策', () => {
    const entries = [e({ note: '=1+1' })];
    expect(buildIndexCsv(entries, buildAll(entries))).toContain("'=1+1");
  });
  it('日付推測', () => { expect(guessFromFilename('invoice_20261109.pdf').date).toBe('2026-11-09'); expect(guessFromFilename('x.pdf')).toEqual({}); });
});
