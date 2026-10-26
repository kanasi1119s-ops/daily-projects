import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, daysBetween, parseDate } from '../src/validate.js';
import { buildDocument, formatYen, formatDate } from '../src/render.js';

const base = () => ({
  clientName: '株式会社サンプル', freelancerName: '山田太郎', orderDate: '2026-10-01',
  workContent: 'バナー制作', deliveryDate: '2026-10-20', place: 'メール納品',
  inspection: false, inspectionDate: '', fee: '150000', feeMethod: '',
  payDue: '2026-11-30', cashless: false, cashlessDetail: '',
});

test('正常入力はエラーなし', () => {
  const r = validate(base());
  assert.deepEqual(r.errors, []);
  assert.equal(r.payDays, 41);
});
test('必須項目の欠落を検出', () => {
  const r = validate({});
  assert.ok(r.errors.length >= 8);
});
test('支払期日が60日超ならエラー、60日ちょうどは警告のみ', () => {
  assert.ok(validate({ ...base(), payDue: '2026-12-20' }).errors.some((e) => e.includes('60日以内')));
  const r = validate({ ...base(), payDue: '2026-12-19' });
  assert.equal(r.payDays, 60);
  assert.deepEqual(r.errors, []);
  assert.equal(r.warnings.length, 1);
});
test('支払期日が受領日より前はエラー', () => {
  assert.ok(validate({ ...base(), payDue: '2026-10-19' }).errors.length > 0);
});
test('報酬は額か算定方法のどちらか必須', () => {
  assert.ok(validate({ ...base(), fee: '' }).errors.length > 0);
  assert.deepEqual(validate({ ...base(), fee: '', feeMethod: '時給5000円×時間' }).errors, []);
});
test('報酬額の不正値', () => {
  for (const fee of ['0', '-5', '1.5', 'abc', '0円']) {
    assert.ok(validate({ ...base(), fee }).errors.length > 0, fee);
  }
});
test('カンマ・全角数字・円付きの報酬額を受理', () => {
  for (const fee of ['150,000', '１５０，０００', '150000円', ' 150000 ']) {
    assert.deepEqual(validate({ ...base(), fee }).errors, [], fee);
  }
  assert.match(buildDocument({ ...base(), fee: '１５０，０００円' }), /150,000円/);
});
test('検収あり時は完了日必須', () => {
  assert.ok(validate({ ...base(), inspection: true }).errors.length > 0);
  assert.deepEqual(validate({ ...base(), inspection: true, inspectionDate: '2026-10-25' }).errors, []);
});
test('現金以外の支払は詳細必須', () => {
  assert.ok(validate({ ...base(), cashless: true }).errors.length > 0);
});
test('存在しない日付を弾く', () => {
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(daysBetween('2026-02-30', '2026-03-01'), null);
  assert.ok(validate({ ...base(), deliveryDate: '2026-02-30' }).errors.length > 0);
});
test('うるう年・月跨ぎの日数計算', () => {
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
});
test('通知書の生成', () => {
  const t = buildDocument(base());
  assert.match(t, /150,000円/);
  assert.match(t, /2026年11月30日/);
  assert.match(t, /検査:なし/);
  assert.equal(formatYen('1234567'), '1,234,567円');
  assert.equal(formatDate('bad'), '');
});
