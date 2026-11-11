import test from 'node:test';
import assert from 'node:assert/strict';
import { check, parseDate, parseAmount, generateText } from '../src/checker.js';

const full = { clientName: 'A社', contractorName: '山田', orderDate: '2026-04-01', description: 'ロゴ制作', deliveryDate: '2026-04-30', deliveryPlace: 'メール', amount: '100,000', taxIncluded: 'excl', paymentDate: '2026-05-31' };

test('完全な入力はエラーなし', () => { const r = check(full); assert.equal(r.errors, 0); assert.equal(r.warnings, 0); });
test('空入力は必須項目が欠落', () => { assert.equal(check({}).errors, 8); });
test('不正日付', () => { assert.equal(parseDate('2026-02-30'), null); assert.equal(parseDate('2026-2-3'), null); assert.ok(parseDate('2026-02-28')); });
test('金額パース', () => { assert.equal(parseAmount('１０，０００円'), 10000); assert.equal(parseAmount('abc'), null); assert.equal(parseAmount(''), null); });
test('支払期日60日超は警告', () => { const r = check({ ...full, paymentDate: '2026-08-01' }); assert.equal(r.warnings, 1); });
test('支払期日が納期前は警告', () => { assert.equal(check({ ...full, paymentDate: '2026-04-01' }).warnings, 1); });
test('税区分未選択は警告', () => { assert.equal(check({ ...full, taxIncluded: '' }).warnings, 1); });
test('金額0は不正', () => { assert.equal(check({ ...full, amount: '0' }).errors, 1); });
test('生成テキストに未記入表示', () => { assert.match(generateText({}), /【未記入】/); });
test('生成テキストに税込表示', () => { assert.match(generateText({ ...full, taxIncluded: 'incl' }), /100,000円（税込）/); });
test('任意項目が不正日付ならエラー', () => { assert.equal(check({ ...full, inspectionDate: '2026-13-01' }).errors, 1); });

// Debug round 1 追加
test('巨大金額は不正扱い', () => { assert.equal(parseAmount('99999999999999999999'), null); });

// Debug round 2 追加
test('うるう日', () => { assert.ok(parseDate('2028-02-29')); assert.equal(parseDate('2026-02-29'), null); });
test('空白のみは未記入', () => { assert.equal(check({ ...full, description: '   ' }).errors, 1); });
test('検査完了日が納期前は警告', () => { assert.equal(check({ ...full, inspectionDate: '2026-04-10' }).warnings, 1); });
test('納期が委託日より前は警告', () => { assert.equal(check({ ...full, deliveryDate: '2026-03-01', paymentDate: '2026-04-15' }).warnings, 1); });
test('ちょうど60日は警告なし', () => { assert.equal(check({ ...full, paymentDate: '2026-06-29' }).warnings, 0); });
test('61日は警告', () => { assert.equal(check({ ...full, paymentDate: '2026-06-30' }).warnings, 1); });
