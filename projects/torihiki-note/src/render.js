import { parseDate, normalizeFee } from './validate.js';

export function formatDate(value) {
  if (parseDate(value) === null) return '';
  const [y, m, d] = value.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

export function formatYen(value) {
  return `${String(Number(normalizeFee(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}円`;
}

const line = (label, value) => `${label}:${value}`;

export function buildDocument(d) {
  const out = [];
  out.push('取引条件通知書(業務委託に係る明示事項)');
  out.push('');
  out.push(line('発注事業者', d.clientName.trim()));
  out.push(line('受注者(フリーランス)', d.freelancerName.trim()));
  out.push(line('業務委託をした日', formatDate(d.orderDate)));
  out.push('');
  out.push('1. 給付の内容(業務内容)');
  out.push(d.workContent.trim());
  out.push('');
  out.push(line('2. 給付を受領する日/役務の提供を受ける日', formatDate(d.deliveryDate)));
  out.push(line('3. 給付を受領する場所/役務の提供を受ける場所', d.place.trim()));
  if (d.inspection) {
    out.push(line('4. 検査を完了する日', formatDate(d.inspectionDate)));
  } else {
    out.push('4. 検査:なし');
  }
  const fee = [];
  if (d.fee && d.fee.trim()) fee.push(formatYen(d.fee));
  if (d.feeMethod && d.feeMethod.trim()) fee.push(d.feeMethod.trim());
  out.push(line('5. 報酬の額', fee.join(' / ')));
  out.push(line('6. 報酬の支払期日', formatDate(d.payDue)));
  out.push(line('7. 支払方法', d.cashless ? `現金以外(${d.cashlessDetail.trim()})` : '現金(銀行振込等)'));
  out.push('');
  out.push('※ 本書面は、特定受託事業者に係る取引の適正化等に関する法律(フリーランス・事業者間取引適正化等法)第3条に基づく明示事項の記載例です。');
  return out.join('\n');
}

// 発注事業者が守るべき禁止行為(法第5条・1か月以上の業務委託)の自己点検項目。
export const PROHIBITED_ACTS = [
  '受領を拒否していないか(フリーランスに責任がないのに納品を受け取らない)',
  '報酬を減額していないか(フリーランスに責任がないのに事前合意の額から減らす)',
  '返品していないか(受領後にフリーランスに責任がないのに引き取らせる)',
  '買いたたきをしていないか(通常の対価より著しく低い額を不当に定める)',
  '購入・利用を強制していないか(指定する物やサービスを強制的に買わせる)',
  '不当な経済上の利益の提供要請をしていないか(協賛金など金銭・労務の提供を要請する)',
  '不当な給付内容の変更ややり直しをさせていないか(費用を負担せず変更ややり直しをさせる)',
];
