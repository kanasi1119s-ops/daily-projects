const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');

const base = {
  clientName: '株式会社A', freelancerName: '山田太郎', orderDate: '2026-11-01',
  description: 'LP制作', deliveryDate: '2026-11-30', deliveryPlace: '電子納品',
  fee: '100000', paymentDue: '2026-12-25', inspection: 'no', feeUndetermined: 'no',
};

test('valid input ok', () => assert.ok(C.validate(base).ok));
test('missing required', () => assert.ok(C.validate({}).errors.length >= 8));
test('60 day warning', () => {
  const r = C.validate({ ...base, paymentDue: '2027-02-15' });
  assert.ok(r.warnings.some((w) => w.includes('60日')));
});
test('exactly 60 days no warning', () => {
  const r = C.validate({ ...base, paymentDue: '2027-01-29' });
  assert.strictEqual(r.warnings.length, 0);
});
test('invalid date rejected', () => {
  assert.ok(C.validate({ ...base, orderDate: '2026-02-30' }).errors.length > 0);
});
test('fee must be integer', () => {
  assert.ok(C.validate({ ...base, fee: '1.5' }).errors.length > 0);
  assert.ok(C.validate({ ...base, fee: '-1' }).errors.length > 0);
  assert.ok(C.validate({ ...base, fee: 'abc' }).errors.length > 0);
});
test('delivery before order is error', () => {
  assert.ok(C.validate({ ...base, deliveryDate: '2026-10-01' }).errors.length > 0);
});
test('undetermined fee needs calc method and skips fee requirement', () => {
  const v = { ...base, fee: '', feeUndetermined: 'yes' };
  assert.ok(C.validate(v).errors.some((e) => e.includes('算定方法')));
  assert.ok(C.validate({ ...v, feeCalc: '時給5000円×稼働時間' }).ok);
});
test('inspection date warning', () => {
  assert.ok(C.validate({ ...base, inspection: 'yes' }).warnings.some((w) => w.includes('検査')));
});
test('notice contains items', () => {
  const t = C.buildNotice({ ...base, taxNote: '税込' });
  assert.ok(t.includes('¥100,000(税込)') && t.includes('山田太郎') && t.includes('2026-12-25'));
});
test('undetermined notice', () => {
  const t = C.buildNotice({ ...base, feeUndetermined: 'yes', feeCalc: '時給' });
  assert.ok(t.includes('未定(算定方法: 時給)'));
});
test('date error uses Japanese label', () => {
  const e = C.validate({ ...base, orderDate: '2026-02-30' }).errors.join();
  assert.ok(e.includes('業務委託をした日') && !e.includes('orderDate'));
});
test('fee normalization: commas and full-width', () => {
  assert.ok(C.validate({ ...base, fee: '１００,０００円' }).ok);
  assert.ok(C.buildNotice({ ...base, fee: '１００,０００' }).includes('¥100,000'));
});
