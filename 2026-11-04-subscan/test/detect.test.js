import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV, detectColumns, decodeBuffer } from '../src/csv.js';
import { parseDate, parseAmount, toTransactions, detectRecurring, buildICS, normalizeMerchant } from '../src/detect.js';

const run = (txt) => { const r = parseCSV(txt); return detectRecurring(toTransactions(r, detectColumns(r))); };

test('サンプルCSVから月次3件+ジムを検出し、スーパー/カフェは除外', () => {
  const f = run(readFileSync(new URL('../sample/sample.csv', import.meta.url), 'utf8'));
  const names = f.map((x) => x.label).sort();
  assert.deepEqual(names, ['NETFLIX.COM', 'SPOTIFY JAPAN', 'クラウドストレージ ABC', 'ジム FIT24'].sort());
  assert.equal(f.find((x) => x.label === 'NETFLIX.COM').annual, 1490 * 12);
});
test('parseDate 各形式', () => {
  assert.equal(parseDate('2026/6/3').toISOString().slice(0, 10), '2026-06-03');
  assert.equal(parseDate('2026年06月03日').toISOString().slice(0, 10), '2026-06-03');
  assert.equal(parseDate('２０２６-０６-０３').toISOString().slice(0, 10), '2026-06-03');
  assert.equal(parseDate('2026/02/30'), null);
  assert.equal(parseDate('abc'), null);
});
test('parseAmount 各形式', () => {
  assert.equal(parseAmount('¥1,490'), 1490);
  assert.equal(parseAmount('1,490円'), 1490);
  assert.equal(parseAmount('-980'), -980);
  assert.equal(parseAmount('△980'), -980);
  assert.equal(parseAmount('12.5'), 12.5);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
});
test('CSV: 引用符・改行・BOM・CRLF', () => {
  const r = parseCSV('﻿日付,内容,金額\r\n2026/01/01,"A, ""B""",100\r\n2026/02/01,"x\ny",200\r\n');
  assert.equal(r.length, 3);
  assert.equal(r[1][1], 'A, "B"');
  assert.equal(r[2][1], 'x\ny');
});
test('返金(逆符号)は除外、出金が負の明細も扱える', () => {
  const f = run('日付,摘要,出金金額\n2026/01/05,FOO,-500\n2026/02/05,FOO,-500\n2026/03/05,FOO,-500\n2026/03/06,FOO,500\n');
  assert.equal(f.length, 1);
  assert.equal(f[0].count, 3);
});
test('年額プランの検出(約1年間隔)', () => {
  const f = run('日付,内容,金額\n2025/03/10,ANNUAL SVC,12000\n2026/03/09,ANNUAL SVC,12000\n');
  assert.equal(f[0].cycle, 'yearly');
  assert.equal(f[0].monthly, 1000);
});
test('金額がバラバラな店は検出しない', () => {
  const f = run('日付,内容,金額\n2026/01/05,SHOP,100\n2026/02/05,SHOP,5000\n2026/03/05,SHOP,320\n');
  assert.equal(f.length, 0);
});
test('伝票番号違いを同一店舗に正規化', () => {
  assert.equal(normalizeMerchant('ＮＥＴＦＬＩＸ*12345678'), 'NETFLIX');
});
test('ICSはCRLFで特殊文字をエスケープ', () => {
  const ics = buildICS([{ label: 'A,B;C', amount: 100, next: new Date(Date.UTC(2026, 10, 10)) }], 3, new Date(Date.UTC(2026, 10, 4)));
  assert.match(ics, /\r\n/);
  assert.match(ics, /A\\,B\;C/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261107/);
});
test('Shift_JISをデコードできる', () => {
  const sjis = new Uint8Array([0x93, 0xfa, 0x95, 0x74]); // 日付
  assert.equal(decodeBuffer(sjis), '日付');
});
// --- デバッグ1回目で追加 ---
test('[fix1] 文中の " でCSV行が欠落しない', () => {
  assert.equal(parseCSV('日付,内容,金額\n2026/01/01,5" monitor,100\n2026/02/01,B,200\n').length, 3);
});
test('[fix2] 支払区分列を金額列と誤認しない', () => {
  const r = parseCSV('ご利用日,ご利用店名,支払区分,ご利用金額\n2026/01/01,X,1回払い,100\n');
  assert.equal(detectColumns(r).amt, 3);
});
test('[fix3] 古い明細でも次回目安は今日以降', () => {
  const r = parseCSV('日付,内容,金額\n2024/01/05,OLD,500\n2024/02/05,OLD,500\n2024/03/05,OLD,500\n');
  const f = detectRecurring(toTransactions(r, detectColumns(r)), new Date(Date.UTC(2026, 10, 4)))[0];
  assert.ok(f.next >= new Date(Date.UTC(2026, 10, 4)));
  assert.equal(f.rolled, true);
});
