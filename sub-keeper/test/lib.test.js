import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyCost, yearlyCost, totals, nextPayment, upcoming, validate, buildIcs, toCsv, importCsv, byCategory } from '../src/lib.js';

const s = (o) => ({ id: 'x', name: 'N', amount: 1000, cycle: 'monthly', nextDate: '2026-10-20', category: 'その他', ...o });

test('月額・年額換算', () => {
  assert.equal(monthlyCost(s({ amount: 12000, cycle: 'yearly' })), 1000);
  assert.equal(monthlyCost(s({ amount: 3000, cycle: 'quarterly' })), 1000);
  assert.equal(yearlyCost(s({ amount: 1000 })), 12000);
  assert.equal(monthlyCost(s({ amount: -5 })), 0);
  assert.equal(monthlyCost(s({ cycle: 'bogus' })), 0);
});

test('合計は停止中を除く', () => {
  const t = totals([s({}), s({ active: false }), s({ amount: 12000, cycle: 'yearly' })]);
  assert.deepEqual(t, { monthly: 2000, yearly: 24000, count: 2 });
});

test('次回支払日: 未来はそのまま、過去は周期進行', () => {
  assert.equal(nextPayment(s({ nextDate: '2026-11-01' }), '2026-10-15'), '2026-11-01');
  assert.equal(nextPayment(s({ nextDate: '2026-08-20' }), '2026-10-15'), '2026-10-20');
  assert.equal(nextPayment(s({ nextDate: '2025-10-15', cycle: 'yearly' }), '2026-10-15'), '2026-10-15');
  assert.equal(nextPayment(s({ nextDate: '2026-10-01', cycle: 'weekly' }), '2026-10-15'), '2026-10-15');
  assert.equal(nextPayment(s({ nextDate: '2026-10-02', cycle: 'weekly' }), '2026-10-15'), '2026-10-16');
});

test('月末クランプが累積しない', () => {
  assert.equal(nextPayment(s({ nextDate: '2026-01-31' }), '2026-02-15'), '2026-02-28');
  assert.equal(nextPayment(s({ nextDate: '2026-01-31' }), '2026-03-15'), '2026-03-31');
  assert.equal(nextPayment(s({ nextDate: '2024-02-29', cycle: 'yearly' }), '2026-03-01'), '2027-02-28');
});

test('不正日付はnull', () => {
  assert.equal(nextPayment(s({ nextDate: '2026-02-30' }), '2026-10-15'), null);
  assert.equal(nextPayment(s({ nextDate: '' }), '2026-10-15'), null);
});

test('upcoming: 範囲と順序', () => {
  const r = upcoming([s({ name: 'B', nextDate: '2026-11-10' }), s({ name: 'A', nextDate: '2026-10-16' }), s({ name: 'C', nextDate: '2026-12-31', cycle: 'yearly' })], '2026-10-15', 30);
  assert.deepEqual(r.map((x) => x.sub.name), ['A', 'B']);
});

test('validate', () => {
  assert.equal(validate(s({})).length, 0);
  assert.ok(validate(s({ name: '  ' })).length);
  assert.ok(validate(s({ amount: NaN })).length);
  assert.ok(validate(s({ amount: 1e9 })).length);
  assert.ok(validate(s({ nextDate: '2026-13-01' })).length);
});

test('ICS: 構造とエスケープ', () => {
  const ics = buildIcs([s({ id: 'a1', name: 'A,B;C', amount: 1500 })], '2026-10-15', 3);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261020/);
  assert.match(ics, /DTEND;VALUE=DATE:20261021/);
  assert.match(ics, /A\\,B\;C/);
  assert.match(ics, /TRIGGER:-P3D/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
});

test('CSV往復とインジェクション対策', () => {
  const src = [s({ name: '=SUM(A1)', note: 'a,"b"\nc' }), s({ name: 'Netflix', amount: 1490 })];
  const csv = toCsv(src);
  assert.ok(csv.includes("'=SUM(A1)"));
  const { subs, skipped } = importCsv(csv);
  assert.equal(skipped, 0);
  assert.equal(subs[0].name, '=SUM(A1)');
  assert.equal(subs[0].note, 'a,"b"\nc');
  assert.equal(subs[1].amount, 1490);
});

test('CSV: 不正行スキップ・不正ヘッダ・未知カテゴリ', () => {
  const bad = importCsv('name,amount,cycle,nextDate,category\nX,abc,monthly,2026-10-20,動画・音楽\nY,100,monthly,2026-10-20,謎\n');
  assert.equal(bad.skipped, 1);
  assert.equal(bad.subs[0].category, 'その他');
  assert.ok(importCsv('foo,bar\n1,2\n').error);
  assert.deepEqual(importCsv(''), { subs: [], skipped: 0 });
});

test('カテゴリ集計', () => {
  const r = byCategory([s({ category: 'A', amount: 100 }), s({ category: 'B', amount: 500 }), s({ category: 'A', amount: 100 })]);
  assert.deepEqual(r, [{ category: 'B', monthly: 500 }, { category: 'A', monthly: 200 }]);
});

import { sanitize } from '../src/lib.js';
test('sanitize: 壊れたデータを除外し補正する', () => {
  const r = sanitize([null, 1, 'x', {}, { name: 'a', amount: 'abc', cycle: 'monthly', nextDate: '2026-01-01' }, { name: 'ok', amount: 100, cycle: 'monthly', nextDate: '2026-01-01', category: '??' }]);
  assert.equal(r.length, 1);
  assert.equal(r[0].category, 'その他');
  assert.ok(r[0].id);
  assert.deepEqual(sanitize('nope'), []);
});
test('小数金額・0円', () => {
  assert.equal(Math.round(monthlyCost(s({ amount: 0 }))), 0);
  assert.equal(totals([s({ amount: 99.5 })]).monthly, 100);
});
