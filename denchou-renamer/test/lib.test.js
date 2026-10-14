import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalizeDate, parseAmount, buildName, dedupeNames, buildCsv, buildZip, sanitizePart } from '../src/lib.js';

test('normalizeDate', () => {
  assert.equal(normalizeDate('2026-10-14'), '20261014');
  assert.equal(normalizeDate('2026/1/5'), '20260105');
  assert.equal(normalizeDate('20260229'), null);
  assert.equal(normalizeDate('2024-02-29'), '20240229');
  assert.equal(normalizeDate(''), null);
});
test('parseAmount', () => {
  assert.equal(parseAmount('110,000円'), 110000);
  assert.equal(parseAmount('１２３'), 123);
  assert.equal(parseAmount('12.5'), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount(''), null);
});
test('sanitizePart', () => assert.equal(sanitizePart('株式会社 A/B:C'), '株式会社ABC'));
test('buildName ok / errors', () => {
  const r = buildName({ date: '2026-10-14', partner: '株式会社A', amount: '110,000', docType: '請求書', original: 'scan.PDF' });
  assert.equal(r.name, '20261014_株式会社A_110000_請求書.pdf');
  const bad = buildName({ date: 'x', partner: '', amount: 'a', docType: '', original: 'a.pdf' });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 3);
});
test('dedupeNames', () => {
  assert.deepEqual(dedupeNames(['a.pdf', 'A.pdf', null, 'b.pdf', 'a.pdf']), ['a.pdf', 'A_2.pdf', null, 'b.pdf', 'a_3.pdf']);
});
test('csv escapes and neutralizes formulas', () => {
  const c = buildCsv([{ name: 'n', date: '20261014', amount: 1, partner: '=HYPERLINK("x")', docType: 'a,b', original: 'o' }]);
  assert.ok(c.startsWith('﻿'));
  assert.ok(c.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(c.includes('"a,b"'));
});
test('zip is valid (python zipfile)', () => {
  const z = buildZip([
    { name: '日本語.txt', data: new TextEncoder().encode('こんにちは') },
    { name: 'b.bin', data: new Uint8Array(70000).fill(7) },
    { name: 'empty.txt', data: new Uint8Array(0) },
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  const f = join(dir, 't.zip');
  writeFileSync(f, z);
  const out = execFileSync('python3', ['-I', '-c',
    'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(sorted(z.namelist()));print(z.read("日本語.txt").decode())', f]).toString();
  assert.ok(out.includes('日本語.txt'));
  assert.ok(out.includes('こんにちは'));
});
