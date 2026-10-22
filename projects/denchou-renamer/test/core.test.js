import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDate, normalizeAmount, sanitizePart, buildFileName, dedupeNames, toCsv, crc32, makeZip } from '../src/core.js';

test('normalizeDate', () => {
  assert.equal(normalizeDate('2026-04-01'), '20260401');
  assert.equal(normalizeDate('2026/4/1'), '20260401');
  assert.equal(normalizeDate('20260401'), '20260401');
  assert.equal(normalizeDate('２０２６－０４－０１'), '20260401');
  assert.equal(normalizeDate('2026-02-30'), null);
  assert.equal(normalizeDate('abc'), null);
});
test('normalizeAmount', () => {
  assert.equal(normalizeAmount('110,000円'), '110000');
  assert.equal(normalizeAmount('¥１，２００'), '1200');
  assert.equal(normalizeAmount('-5'), null);
  assert.equal(normalizeAmount('1.5'), null);
  assert.equal(normalizeAmount(''), null);
});
test('sanitizePart', () => {
  assert.equal(sanitizePart('株式会社 A/B:C'), '株式会社ABC');
  assert.equal(sanitizePart('..hidden'), 'hidden');
  assert.equal(sanitizePart('con'), 'con_');
  assert.equal(sanitizePart('株式会社A.'), '株式会社A');
});
test('buildFileName', () => {
  const r = buildFileName({ date: '2026/4/1', vendor: '株式会社テスト', amount: '1,000', originalName: 'scan.PDF' });
  assert.deepEqual([r.ok, r.name], [true, '20260401_株式会社テスト_1000.pdf']);
  assert.equal(buildFileName({ date: 'x', vendor: '', amount: 'y', originalName: 'a.pdf' }).errors.length, 3);
});
test('dedupeNames', () => {
  assert.deepEqual(dedupeNames(['a.pdf', 'A.pdf', 'b.pdf', 'a.pdf']), ['a.pdf', 'A_2.pdf', 'b.pdf', 'a_3.pdf']);
});
test('toCsv escapes and neutralizes formulas', () => {
  const csv = toCsv([{ name: 'n', originalName: '=cmd', date: '1', vendor: 'a,"b"', amount: '1' }]);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes("'=cmd"));
  assert.ok(csv.includes('"a,""b"""'));
});
test('crc32 known vector', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
test('makeZip structure', () => {
  const z = makeZip([{ name: 'あ.txt', data: new TextEncoder().encode('hello') }]);
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  assert.equal(dv.getUint32(z.length - 22, true), 0x06054b50);
  assert.equal(dv.getUint16(z.length - 22 + 10, true), 1);
});
