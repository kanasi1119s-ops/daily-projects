import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../src/core.js';

const mk = (o = {}) => ({ id: 'a1', name: 'X', amount: 1200, cycle: 'monthly', billingDate: '2026-01-31', usage: 3, category: 'その他', memo: '', ...o });

test('monthlyCost / yearlyCost', () => {
  assert.equal(c.monthlyCost(mk({ cycle: 'yearly', amount: 12000 })), 1000);
  assert.equal(c.monthlyCost(mk({ cycle: 'quarterly', amount: 3000 })), 1000);
  assert.equal(c.monthlyCost(mk({ cycle: 'weekly', amount: 120 })), 520);
  assert.equal(c.yearlyCost(mk({ amount: 100 })), 1200);
});

test('isValidDate', () => {
  assert.ok(c.isValidDate('2024-02-29'));
  assert.ok(!c.isValidDate('2025-02-29'));
  assert.ok(!c.isValidDate('2025-13-01'));
  assert.ok(!c.isValidDate('2025-1-1'));
  assert.ok(!c.isValidDate(null));
});

test('addMonths clamps to month end and keeps anchor day', () => {
  assert.equal(c.addMonths('2026-01-31', 1, 31), '2026-02-28');
  assert.equal(c.addMonths('2026-01-31', 2, 31), '2026-03-31');
  assert.equal(c.addMonths('2024-01-31', 1, 31), '2024-02-29');
  assert.equal(c.addMonths('2026-11-15', 3, 15), '2027-02-15');
  assert.equal(c.addMonths('2026-12-10', 1), '2027-01-10');
});

test('nextRenewal: future anchor returned as is, today included', () => {
  assert.equal(c.nextRenewal(mk({ billingDate: '2026-12-01' }), '2026-11-06'), '2026-12-01');
  assert.equal(c.nextRenewal(mk({ billingDate: '2026-11-06' }), '2026-11-06'), '2026-11-06');
});
test('nextRenewal monthly from past, month-end anchor', () => {
  assert.equal(c.nextRenewal(mk({ billingDate: '2026-01-31' }), '2026-02-01'), '2026-02-28');
  assert.equal(c.nextRenewal(mk({ billingDate: '2026-01-31' }), '2026-03-01'), '2026-03-31');
  assert.equal(c.nextRenewal(mk({ billingDate: '2025-05-10' }), '2026-11-06'), '2026-11-10');
  assert.equal(c.nextRenewal(mk({ billingDate: '2025-05-10' }), '2026-11-11'), '2026-12-10');
});
test('nextRenewal yearly / quarterly / weekly', () => {
  assert.equal(c.nextRenewal(mk({ cycle: 'yearly', billingDate: '2024-02-29' }), '2025-03-01'), '2026-02-28');
  assert.equal(c.nextRenewal(mk({ cycle: 'yearly', billingDate: '2024-11-05' }), '2026-11-06'), '2027-11-05');
  assert.equal(c.nextRenewal(mk({ cycle: 'quarterly', billingDate: '2026-01-15' }), '2026-11-06'), '2027-01-15');
  assert.equal(c.nextRenewal(mk({ cycle: 'weekly', billingDate: '2026-11-01' }), '2026-11-06'), '2026-11-08');
  assert.equal(c.nextRenewal(mk({ cycle: 'weekly', billingDate: '2026-10-30' }), '2026-11-06'), '2026-11-06');
});

test('nextRenewal always >= today and within one cycle (fuzz)', () => {
  const cycles = Object.keys(c.CYCLES);
  const maxDays = { weekly: 7, monthly: 31, quarterly: 92, yearly: 366 };
  let seed = 7; const rnd = (n) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
  for (let i = 0; i < 3000; i++) {
    const cycle = cycles[rnd(4)];
    const a = c.addDays('2020-01-01', rnd(3000)), t = c.addDays('2020-01-01', rnd(3000));
    const n = c.nextRenewal(mk({ cycle, billingDate: a }), t);
    const d = c.daysBetween(t, n);
    assert.ok(d >= 0 && (c.daysBetween(t, a) >= 0 || d <= maxDays[cycle]), `${cycle} ${a} ${t} -> ${n}`);
  }
});

test('validateItem', () => {
  assert.ok(c.validateItem(mk()).ok);
  assert.ok(!c.validateItem(mk({ name: '  ' })).ok);
  assert.ok(!c.validateItem(mk({ amount: -1 })).ok);
  assert.ok(!c.validateItem(mk({ amount: 'abc' })).ok);
  assert.ok(!c.validateItem(mk({ amount: '' })).ok);
  assert.ok(!c.validateItem(mk({ amount: NaN })).ok);
  assert.ok(!c.validateItem(mk({ cycle: 'daily' })).ok);
  assert.ok(!c.validateItem(mk({ cycle: '__proto__' })).ok);
  assert.ok(!c.validateItem(mk({ cycle: 'toString' })).ok);
  assert.ok(!c.validateItem(mk({ billingDate: '2026-02-30' })).ok);
  assert.ok(!c.validateItem(mk({ usage: 6 })).ok);
  assert.ok(!c.validateItem(mk({ usage: 2.5 })).ok);
  assert.equal(c.validateItem(mk({ amount: '980' })).item.amount, 980);
  assert.equal(c.validateItem(mk({ category: 'zzz' })).item.category, 'その他');
  assert.equal(c.validateItem(mk({ id: '../x' })).item.id, null);
});

test('summarize', () => {
  const items = [mk({ id: '1', name: 'A', amount: 1000, billingDate: '2026-11-10', usage: 1 }), mk({ id: '2', name: 'B', amount: 12000, cycle: 'yearly', billingDate: '2027-06-01', usage: 5 })];
  const s = c.summarize(items, '2026-11-06');
  assert.equal(s.monthly, 2000);
  assert.equal(s.yearly, 24000);
  assert.equal(s.upcoming.length, 1);
  assert.equal(s.upcoming[0].days, 4);
  assert.equal(s.candidates.length, 1);
  assert.equal(s.potentialYearlySaving, 12000);
});

test('CSV: injection guard and quoting', () => {
  assert.equal(c.csvCell('=1+1'), "'=1+1");
  assert.equal(c.csvCell('@x'), "'@x");
  assert.equal(c.csvCell('-5'), "'-5");
  assert.equal(c.csvCell('a,"b"'), '"a,""b"""');
  assert.equal(c.csvCell(null), '');
  const out = c.toCSV([mk({ name: '=cmd|x' })], '2026-11-06');
  assert.ok(out.startsWith('﻿'));
  assert.ok(out.includes("'=cmd|x"));
});

test('ICS structure, escaping, folding', () => {
  const now = new Date('2026-11-06T00:00:00Z');
  const ics = c.toICS([mk({ name: 'A;B,C\nD', billingDate: '2026-12-31', memo: 'メモ'.repeat(40) })], '2026-11-06', { now });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261231'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20270101'));
  assert.ok(ics.includes('DTSTAMP:20261106T000000Z'));
  assert.ok(ics.includes('BYMONTHDAY=28,29,30,31;BYSETPOS=-1'));
  assert.ok(ics.includes('A\\;B\\,C\\nD'));
  const enc = new TextEncoder();
  for (const l of ics.split('\r\n')) assert.ok(enc.encode(l).length <= 75, 'line too long: ' + l);
  // 折り返しを戻すと元の文字列が壊れていない
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('メモ'.repeat(40)));
  assert.ok(!/�/.test(ics));
});
test('ICS rrule variants', () => {
  const r = (o) => c.toICS([mk(o)], '2026-11-06', { now: new Date(0) });
  assert.ok(r({ cycle: 'weekly' }).includes('RRULE:FREQ=WEEKLY'));
  assert.ok(r({ cycle: 'yearly' }).includes('RRULE:FREQ=YEARLY'));
  assert.ok(r({ cycle: 'quarterly', billingDate: '2026-11-10' }).includes('RRULE:FREQ=MONTHLY;INTERVAL=3'));
  assert.ok(r({ billingDate: '2026-11-30' }).includes('BYMONTHDAY=28,29,30;'));
});

test('importJSON', () => {
  assert.ok(c.importJSON('{bad').error);
  assert.ok(c.importJSON('{"a":1}').error);
  const r = c.importJSON(JSON.stringify({ items: [mk(), { name: '' }, null] }));
  assert.equal(r.items.length, 1);
  assert.equal(r.skipped, 2);
  assert.equal(c.importJSON(JSON.stringify([mk()])).items.length, 1);
});
