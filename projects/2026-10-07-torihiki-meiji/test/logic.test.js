import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, generateDocument, addDays, latestPaymentDate, parseAmount, parseDate, formatJa } from '../src/logic.js';

const ok = {
  clientName: '株式会社テスト', freelancerName: '山田太郎', orderDate: '2026-10-01',
  workDescription: 'LP制作', deliveryDate: '2026-10-31', deliveryPlace: 'オンライン',
  amount: '150,000', paymentDate: '2026-11-30',
};

test('完全な入力はエラーなし', () => {
  const r = validate(ok);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});
test('必須項目の欠落を検出', () => {
  const r = validate({});
  assert.equal(r.errors.length, 8);
});
test('日付計算: 月またぎ・うるう年', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(parseDate('2026-02-30'), null);
});
test('支払期日の上限は受領日を1日目として60日目', () => {
  assert.equal(latestPaymentDate('2026-10-01'), '2026-11-29');
});
test('60日超過で警告', () => {
  const r = validate({ ...ok, paymentDate: '2026-12-31' });
  assert.equal(r.warnings.length, 1);
});
test('境界: 60日目ちょうどは警告なし、翌日は警告', () => {
  assert.equal(validate({ ...ok, deliveryDate: '2026-10-01', paymentDate: '2026-11-29' }).warnings.length, 0);
  assert.equal(validate({ ...ok, deliveryDate: '2026-10-01', paymentDate: '2026-11-30' }).warnings.length, 1);
});
test('金額パース', () => {
  assert.equal(parseAmount('¥1,000円'), 1000);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount('1.5'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('0'), 0);
});
test('検査あり・現金以外は追加項目必須', () => {
  const r = validate({ ...ok, inspect: true, nonCash: true });
  assert.equal(r.errors.length, 2);
});
test('報酬未定は算定方法を出力し警告', () => {
  const f = { ...ok, amount: '', amountUndecided: true, amountMethod: '時間単価×稼働' };
  const doc = generateDocument(f);
  assert.match(doc, /未定\(算定方法: 時間単価×稼働\)/);
  assert.equal(validate({ ...f, amount: '0' }).warnings.length, 1);
});
test('書面生成', () => {
  const doc = generateDocument(ok);
  assert.match(doc, /150,000円 \(税込\)/);
  assert.match(doc, /2026年11月30日/);
  assert.equal(formatJa('bad'), '');
});
