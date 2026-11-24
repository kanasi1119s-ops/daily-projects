// 発注ガード: 純粋ロジック(DOM非依存)。テスト対象。

const DAY_MS = 86400000;

/** "YYYY-MM-DD" を厳密にパース。不正なら null。 */
export function parseDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return t;
}

export function formatDate(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function formatDateJa(iso) {
  const t = parseDate(iso);
  if (t === null) return '';
  const d = new Date(t);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export function addDays(iso, n) {
  const t = parseDate(iso);
  if (t === null) return null;
  return formatDate(t + n * DAY_MS);
}

/**
 * 報酬支払期日の上限。受領日(役務提供日)を起算日=1日目として60日目。
 * ※起算日の数え方は一次資料(公取委・厚労省ガイドライン)で人間が最終確認すること。
 */
export function paymentDeadline(receiptIso) {
  return addDays(receiptIso, 59);
}

/** 指定した支払日が60日ルール内かを判定。 */
export function checkPaymentDate(receiptIso, payIso) {
  const deadline = paymentDeadline(receiptIso);
  const pay = parseDate(payIso);
  if (deadline === null || pay === null) return { ok: false, valid: false, deadline, overDays: 0 };
  const over = Math.round((pay - parseDate(deadline)) / DAY_MS);
  return { ok: over <= 0, valid: true, deadline, overDays: Math.max(0, over) };
}

/** 月末締め翌月末払い等の「締め日」から実際の最悪ケースを計算するためのヘルパー: 翌月末日。 */
export function endOfNextMonth(iso) {
  const t = parseDate(iso);
  if (t === null) return null;
  const d = new Date(t);
  return formatDate(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0));
}

export const REQUIRED_FIELDS = [
  ['clientName', '発注事業者の名称'],
  ['freelancerName', 'フリーランスの名称'],
  ['orderDate', '業務委託をした日'],
  ['workDescription', '業務(給付)の内容'],
  ['deliveryDate', '給付を受領/役務の提供を受ける期日'],
  ['payDate', '報酬の支払期日'],
];

/** 入力検証。errors は必須不足、warnings は法令上の注意。 */
export function validateSpec(f) {
  const errors = [];
  const warnings = [];
  for (const [key, label] of REQUIRED_FIELDS) {
    if (!String(f[key] ?? '').trim()) errors.push(`${label}が未入力です`);
  }
  for (const [key, label] of [['orderDate', '業務委託をした日'], ['deliveryDate', '納期'], ['payDate', '支払期日'], ['inspectionDate', '検査完了日']]) {
    if (String(f[key] ?? '').trim() && parseDate(f[key]) === null) errors.push(`${label}の日付形式が不正です`);
  }
  const hasReward = String(f.reward ?? '').trim() !== '';
  const hasCalc = String(f.rewardCalc ?? '').trim() !== '';
  if (!hasReward && !hasCalc) {
    errors.push('報酬の額、または算定方法のいずれかが必要です');
  } else if (hasReward) {
    const n = Number(String(f.reward).replace(/[,，円\s]/g, ''));
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) errors.push('報酬の額は正の整数で入力してください');
  }
  const order = parseDate(f.orderDate), delivery = parseDate(f.deliveryDate), pay = parseDate(f.payDate);
  if (order !== null && delivery !== null && delivery < order) warnings.push('納期が業務委託日より前になっています');
  if (delivery !== null && pay !== null) {
    // 受領日は納期どおりと仮定して判定(実際の受領日が遅れる場合は②タブで再確認)
    const r = checkPaymentDate(f.deliveryDate, f.payDate);
    if (!r.ok) warnings.push(`支払期日が納期(受領日)から60日以内(${r.deadline}まで)を${r.overDays}日超過しています。法定の上限を超える設定はできません`);
    if (pay < delivery) warnings.push('支払期日が納期より前になっています(前払いの場合は問題ありません)');
  }
  if (f.payMethod && f.payMethod !== '銀行振込' && String(f.payMethodNote ?? '').trim() === '') {
    warnings.push('現金以外の方法で支払う場合は、その方法を具体的に明示する必要があります');
  }
  if (f.feeBearer === 'freelancer') {
    warnings.push('振込手数料をフリーランス負担として報酬から差し引くと「報酬の減額」に当たるおそれがあります。事前に書面で合意があっても実際の振込手数料の範囲内に限る等の注意が必要です(要専門家確認)');
  }
  return { errors, warnings };
}

export function formatYen(v) {
  const n = Number(String(v).replace(/[,，円\s]/g, ''));
  if (!Number.isFinite(n)) return String(v);
  return `${n.toLocaleString('ja-JP')}円`;
}

/** 取引条件明示書の本文(プレーンテキスト)を生成。 */
export function renderSpec(f) {
  const line = (label, value) => `${label}: ${value}`;
  const out = [];
  out.push('取 引 条 件 明 示 書');
  out.push('(特定受託事業者に係る取引の適正化等に関する法律 第3条に基づく明示)');
  out.push('');
  out.push(line('発注事業者', f.clientName + (f.clientContact ? `(連絡先: ${f.clientContact})` : '')));
  out.push(line('フリーランス(受託者)', f.freelancerName + (f.freelancerContact ? `(連絡先: ${f.freelancerContact})` : '')));
  out.push(line('業務委託をした日', formatDateJa(f.orderDate)));
  out.push('');
  out.push('1. 業務(給付)の内容');
  out.push(String(f.workDescription ?? '').trim());
  out.push('');
  out.push(line('2. 給付を受領する/役務の提供を受ける期日', formatDateJa(f.deliveryDate)));
  if (String(f.deliveryPlace ?? '').trim()) out.push(line('   受領/提供の場所', f.deliveryPlace.trim()));
  if (parseDate(f.inspectionDate) !== null) out.push(line('   検査完了日', formatDateJa(f.inspectionDate)));
  out.push('');
  if (String(f.reward ?? '').trim()) {
    out.push(line('3. 報酬の額', formatYen(f.reward) + (f.taxNote ? `(${f.taxNote})` : '')));
  } else {
    out.push(line('3. 報酬の算定方法', String(f.rewardCalc).trim()));
  }
  if (String(f.reward ?? '').trim() && String(f.rewardCalc ?? '').trim()) out.push(line('   算定方法', f.rewardCalc.trim()));
  out.push(line('4. 報酬の支払期日', formatDateJa(f.payDate)));
  const method = f.payMethod === '銀行振込' || !f.payMethod ? '銀行振込' : `${f.payMethod}${f.payMethodNote ? `(${f.payMethodNote})` : ''}`;
  out.push(line('5. 支払方法', method));
  out.push(line('6. 振込手数料', f.feeBearer === 'freelancer' ? 'フリーランス負担' : '発注事業者負担'));
  out.push('');
  out.push('※本書面は雛形作成ツールで生成したものです。実際の契約内容に合わせて確認・修正してください。');
  return out.join('\n');
}

/** 禁止行為(第5条・1か月以上の業務委託)。 */
export const PROHIBITED = [
  { id: 'refuse', q: '納品物の受領を、フリーランスに責任がないのに拒否したことがある/しそう', note: '受領拒否の禁止' },
  { id: 'cut', q: '合意した報酬を、責任のない理由で減額したことがある/しそう(振込手数料の天引きを含む)', note: '報酬の減額の禁止' },
  { id: 'return', q: '受領後に、フリーランスに責任がないのに返品したことがある/しそう', note: '返品の禁止' },
  { id: 'lowball', q: '通常支払われる対価に比べ、著しく低い報酬を不当に定めたことがある/しそう', note: '買いたたきの禁止' },
  { id: 'force', q: '正当な理由なく、自社指定の商品・サービスの購入や利用を強制したことがある/しそう', note: '購入・利用強制の禁止' },
  { id: 'benefit', q: '自社のために金銭・役務その他の経済上の利益を提供させたことがある/しそう', note: '不当な経済上の利益の提供要請の禁止' },
  { id: 'redo', q: '費用を負担せず、給付内容を不当に変更させたり、やり直しをさせたことがある/しそう', note: '不当な給付内容の変更・やり直しの禁止' },
];

export function evaluateProhibited(answers, months = 1) {
  if (months < 1) return { applicable: false, hits: [] };
  const hits = PROHIBITED.filter((p) => answers[p.id] === true);
  return { applicable: true, hits };
}
