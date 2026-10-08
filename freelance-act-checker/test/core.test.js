const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');

test('deadline60 counts receipt day as day 1', () => {
  assert.strictEqual(C.deadline60('2026-04-01'), '2026-05-30');
  assert.strictEqual(C.deadline60('2026-02-31'), null);
  assert.strictEqual(C.deadline60('bad'), null);
});

test('month-end closing, next-month-end payment passes', () => {
  const r = C.verifyPaymentRuleYear({ closingDay: 'end', payMonthOffset: 1, payDay: 'end' }, 2026);
  assert.strictEqual(r.ok, true);
});

test('month-end closing, 10th of month after next fails (known enforcement case)', () => {
  const r = C.verifyPaymentRuleYear({ closingDay: 'end', payMonthOffset: 2, payDay: 10 }, 2026);
  assert.strictEqual(r.ok, false);
  assert.ok(r.worst.elapsed > 60);
  assert.ok(r.months[0].violations > 0);
});

test('closing 25th shifts later receipts to next period', () => {
  const rule = { closingDay: 25, payMonthOffset: 1, payDay: 'end' };
  assert.strictEqual(C.paymentDateFor('2026-01-26', rule), '2026-03-31');
  assert.strictEqual(C.paymentDateFor('2026-01-25', rule), '2026-02-28');
});

test('year-end rollover', () => {
  const rule = { closingDay: 'end', payMonthOffset: 1, payDay: 'end' };
  assert.strictEqual(C.paymentDateFor('2026-12-15', rule), '2027-01-31');
});

test('checkTerms flags missing & over-60', () => {
  const r = C.checkTerms({ deliveryDate: '2026-04-01', payDate: '2026-07-01' });
  assert.ok(r.missing.length > 0);
  assert.ok(r.warnings.some((w) => w.includes('60日')));
});

test('checkTerms passes complete input', () => {
  const r = C.checkTerms({ clientName: 'A', freelancerName: 'B', orderDate: '2026-03-01', content: 'x', deliveryDate: '2026-04-01', place: 'online', reward: '10万円', payDate: '2026-04-30' });
  assert.ok(r.ok, JSON.stringify(r));
});

test('deadlineTwoMonths clamps month end', () => {
  assert.strictEqual(C.deadlineTwoMonths('2026-01-31'), '2026-03-30');
  assert.strictEqual(C.deadlineTwoMonths('2026-04-01'), '2026-05-31');
});

test('freelancer name is required', () => {
  const r = C.checkTerms({ clientName: 'A' });
  assert.ok(r.missing.some((m) => m.includes('フリーランス')));
});

test('worstViolation is itself a violation', () => {
  const r = C.verifyPaymentRule({ closingDay: 'end', payMonthOffset: 2, payDay: 10 }, 2026, 3);
  assert.ok(r.worstViolation && r.worstViolation.elapsed > 60);
});

test('payment before delivery warns', () => {
  const r = C.checkTerms({ deliveryDate: '2026-04-10', payDate: '2026-04-01' });
  assert.ok(r.warnings.some((w) => w.includes('前')));
});
