import test from 'node:test';
import assert from 'node:assert/strict';
import { judgeApplicability as j, evaluate, summarize } from '../src/logic.js';

test('製造委託: 資本金3億超→3億以下は適用', () => {
  assert.equal(j({ type: 'manufacture', clientCapital: 50000, contractorCapital: 1000 }).result, 'yes');
});
test('製造委託: 中間層 受託側が1000万超は資本金基準外(従業員未入力→maybe)', () => {
  assert.equal(j({ type: 'manufacture', clientCapital: 5000, contractorCapital: 2000 }).result, 'maybe');
});
test('情報成果物: 5000万超→個人事業主は適用', () => {
  assert.equal(j({ type: 'info', clientCapital: 6000, contractorCapital: 0 }).result, 'yes');
});
test('情報成果物: 委託側1000万以下かつ従業員少→適用外', () => {
  assert.equal(j({ type: 'info', clientCapital: 1000, contractorCapital: 0, clientEmployees: 50, contractorEmployees: 1 }).result, 'no');
});
test('従業員数基準(役務100人)で適用', () => {
  assert.equal(j({ type: 'service', clientCapital: 500, contractorCapital: 0, clientEmployees: 150, contractorEmployees: 1 }).result, 'yes');
});
test('種類未選択はunknown', () => assert.equal(j({}).result, 'unknown'));
test('資本金未入力はunknown', () => assert.equal(j({ type: 'info' }).result, 'unknown'));

test('支払60日超はNG', () => {
  const r = evaluate({ type: 'info', paymentDays: 75, paymentMethod: 'transfer', writtenTerms: 'yes' });
  assert.equal(r.findings[0].level, 'ng');
});
test('支払60日ちょうどはOK', () => {
  assert.equal(evaluate({ paymentDays: 60 }).findings[0].level, 'ok');
});
test('手形はNG', () => {
  assert.ok(evaluate({ paymentDays: 30, paymentMethod: 'bill' }).findings.some((f) => f.level === 'ng' && f.title.includes('手形')));
});
test('口頭発注はNG', () => {
  assert.ok(evaluate({ writtenTerms: 'no' }).findings.some((f) => f.level === 'ng'));
});
test('チェックした禁止行為がNGとして列挙される', () => {
  const r = evaluate({ practices: ['reduce', 'nonegotiate'] });
  assert.equal(r.findings.filter((f) => f.title.startsWith('違反の恐れ')).length, 2);
});
test('summarize', () => {
  const s = summarize(evaluate({ paymentDays: 90, paymentMethod: 'transfer', writtenTerms: 'yes' }));
  assert.deepEqual(s, { ng: 1, warn: 0, ok: 2 });
});

test('境界: 負数・文字列は未入力扱い', () => {
  assert.equal(j({ type: 'info', clientCapital: -1, contractorCapital: 0 }).result, 'unknown');
  assert.equal(j({ type: 'info', clientCapital: 'abc', contractorCapital: 0 }).result, 'unknown');
});
test('境界: 委託側資本金ちょうど5000万(役務)は上位区分に入らず、1000万以下の受託側が対象', () => {
  assert.equal(j({ type: 'service', clientCapital: 5000, contractorCapital: 1000 }).result, 'yes');
  assert.equal(j({ type: 'service', clientCapital: 5000, contractorCapital: 1001, clientEmployees: 10, contractorEmployees: 1 }).result, 'no');
});
test('境界: 委託側資本金ちょうど1000万は資本金基準外', () => {
  assert.equal(j({ type: 'service', clientCapital: 1000, contractorCapital: 0, clientEmployees: 10, contractorEmployees: 1 }).result, 'no');
});
test('支払日数0日・小数でも例外にならない', () => {
  assert.equal(evaluate({ paymentDays: 0 }).findings[0].level, 'ok');
  assert.equal(evaluate({ paymentDays: 60.5 }).findings[0].level, 'ng');
});
