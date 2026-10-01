import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalizeDate, normalizeAmount, sanitizePart, buildFilename, dedupe, toCsv, makeZip, crc32 } from '../src/lib.js';

test('normalizeDate', () => {
  assert.equal(normalizeDate('2026-04-01'), '20260401');
  assert.equal(normalizeDate('2026/4/1'), '20260401');
  assert.equal(normalizeDate('２０２６年４月１日'), '20260401');
  assert.equal(normalizeDate('20260401'), '20260401');
  assert.equal(normalizeDate('2026-02-30'), null);
  assert.equal(normalizeDate('abc'), null);
  assert.equal(normalizeDate(''), null);
});

test('normalizeAmount', () => {
  assert.equal(normalizeAmount('12,800'), '12800');
  assert.equal(normalizeAmount('¥１２，８００円'), '12800');
  assert.equal(normalizeAmount('0012'), '12');
  assert.equal(normalizeAmount('-5'), null);
  assert.equal(normalizeAmount('1.5'), null);
  assert.equal(normalizeAmount(''), null);
});

test('sanitizePart', () => {
  assert.equal(sanitizePart('株式会社/〇〇:支店'), '株式会社〇〇支店');
  assert.equal(sanitizePart('A B_C'), 'AB-C');
  assert.equal(sanitizePart('..hidden'), 'hidden');
  assert.equal(Array.from(sanitizePart('あ'.repeat(100))).length, 40);
});

test('buildFilename', () => {
  const r = buildFilename({ originalName: 'scan.PDF', date: '2026-04-01', partner: 'Amazon', amount: '1,980', kind: '領収書' });
  assert.equal(r.filename, '20260401_Amazon_1980_領収書.pdf');
  const bad = buildFilename({ originalName: 'a.pdf', date: 'x', partner: '', amount: 'y' });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 3);
  assert.equal(buildFilename({ originalName: 'noext', date: '20260401', partner: 'A', amount: '1' }).filename, '20260401_A_1');
});

test('dedupe', () => {
  assert.deepEqual(dedupe(['a.pdf', 'A.pdf', 'a.pdf', 'b.pdf']), ['a.pdf', 'A-2.pdf', 'a-3.pdf', 'b.pdf']);
  assert.deepEqual(dedupe(['a.pdf', 'a.pdf', 'a-2.pdf']).length, 3);
  assert.equal(new Set(dedupe(['a.pdf', 'a.pdf', 'a-2.pdf']).map((s) => s.toLowerCase())).size, 3);
});

test('toCsv escapes and neutralizes formulas', () => {
  const csv = toCsv([{ filename: 'f', date: '1', partner: '=HYPERLINK("x")', amount: '1', kind: 'a,b', originalName: 'o' }]);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv.includes('"a,b"'));
});

test('crc32 known vector', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('makeZip is valid (python zipfile)', () => {
  const zip = makeZip([
    { name: '20260401_株式会社テスト_1000.pdf', data: new TextEncoder().encode('hello') },
    { name: '索引.csv', data: new Uint8Array(0) },
  ]);
  const p = join(mkdtempSync(join(tmpdir(), 'z-')), 't.zip');
  writeFileSync(p, zip);
  const out = execFileSync('python3', ['-c', `
import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print("|".join(z.namelist())); print(z.read(z.namelist()[0]).decode())`, p]).toString();
  assert.match(out, /20260401_株式会社テスト_1000\.pdf\|索引\.csv/);
  assert.match(out, /hello/);
});

test('windows reserved names / trailing dots / odd extensions', () => {
  assert.equal(sanitizePart('CON'), 'CON-');
  assert.equal(sanitizePart('com1'), 'com1-');
  assert.equal(sanitizePart('abc..'), 'abc');
  assert.equal(buildFilename({ originalName: 'x.p df', date: '20260401', partner: 'A', amount: '1' }).filename, '20260401_A_1.pdf');
});
