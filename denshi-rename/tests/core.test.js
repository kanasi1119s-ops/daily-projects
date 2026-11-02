import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as c from '../src/core.js';

test('normalizeDate: 各形式', () => {
  assert.equal(c.normalizeDate('2026-11-02'), '20261102');
  assert.equal(c.normalizeDate('２０２６/１１/２'), '20261102');
  assert.equal(c.normalizeDate('2026年11月2日'), '20261102');
  assert.equal(c.normalizeDate('令和8年11月2日'), '20261102');
  assert.equal(c.normalizeDate('R8.11.2'), '20261102');
  assert.equal(c.normalizeDate('令和元年5月1日'), '20190501');
  assert.equal(c.normalizeDate('20261102'), '20261102');
});
test('normalizeDate: 不正', () => {
  for (const s of ['', '2026-02-30', '2026-13-01', 'abc', '1800-01-01', '令和8年2月30日']) assert.equal(c.normalizeDate(s), null, s);
});
test('normalizeAmount', () => {
  assert.equal(c.normalizeAmount('¥1,234円'), 1234);
  assert.equal(c.normalizeAmount('１２３'), 123);
  assert.equal(c.normalizeAmount('0'), 0);
  for (const s of ['', '-1', '1.5', 'abc', '99999999999999999999']) assert.equal(c.normalizeAmount(s), null, s);
});
test('sanitizeName', () => {
  assert.equal(c.sanitizeName('A/B:C*D'), 'A_B_C_D');
  assert.equal(c.sanitizeName('  株式会社 テスト  '), '株式会社_テスト');
  assert.equal(c.sanitizeName('..'), '');
  assert.equal(c.sanitizeName('con'), '_con');
  assert.equal(c.sanitizeName('あ'.repeat(100)).length, 60);
});
test('buildFileName / validateRow', () => {
  const row = { date: '2026-11-02', partner: '株式会社A', amount: '110,000' };
  assert.equal(c.buildFileName(row, 'scan.PDF'), '20261102_株式会社A_110000.pdf');
  assert.equal(c.buildFileName({ ...row, amount: 'x' }, 'a.pdf'), null);
  assert.equal(c.validateRow({ date: '', partner: '', amount: '' }).length, 3);
});
test('dedupeNames', () => {
  assert.deepEqual(c.dedupeNames(['a.pdf', 'A.pdf', null, 'b', 'b']), ['a.pdf', 'A_2.pdf', null, 'b', 'b_2']);
});
test('dedupeNames: 生成名が既存名と衝突しない', () => {
  const r = c.dedupeNames(['x.pdf', 'x.pdf', 'x_2.pdf']);
  assert.equal(new Set(r.map((v) => v.toLowerCase())).size, 3);
});
test('sanitizeName: 双方向制御文字を除去', () => {
  assert.equal(c.sanitizeName('A\u202eB\u200b'), 'AB');
});
test('CSV: エスケープとインジェクション対策', () => {
  const csv = c.buildLedgerCsv([{ date: '2026-11-02', amount: '100', partner: '=cmd|"x"', docType: '請求書', note: 'a,b', newName: 'n.pdf', originalName: 'o.pdf' }]);
  assert.ok(csv.startsWith('﻿取引年月日'));
  assert.ok(csv.includes('"\'=cmd|""x"""'));
  assert.ok(csv.includes('"a,b"'));
});
test('ZIP: 実際に unzip で検証', () => {
  const files = [
    { name: '20261102_株式会社A_100.pdf', data: new TextEncoder().encode('hello pdf') },
    { name: '検索台帳.csv', data: new Uint8Array(0) },
  ];
  const zip = c.buildZip(files);
  const dir = mkdtempSync(join(tmpdir(), 'zip-'));
  const p = join(dir, 't.zip');
  writeFileSync(p, zip);
  const out = execFileSync('python3', ['-I', '-c', `
import zipfile,sys
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
print("|".join(z.namelist())); print(z.read(z.namelist()[0]).decode())`, p]).toString();
  assert.match(out, /20261102_株式会社A_100\.pdf\|検索台帳\.csv/);
  assert.match(out, /hello pdf/);
});
