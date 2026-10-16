// 取適法セルフチェックのロジック。DOM非依存(テスト容易性のため)。
// ※ 数値基準は一般的な解説に基づく目安。公開前に公正取引委員会・中小企業庁の一次資料で要確認。

export const TYPES = {
  manufacture: { label: '製造委託・修理委託', group: 'goods' },
  transport: { label: '特定運送委託(発荷主→運送事業者)', group: 'goods' },
  info: { label: '情報成果物作成委託(ソフト・デザイン・動画等)', group: 'service' },
  service: { label: '役務提供委託(運送・倉庫保管・情報処理等)', group: 'service' },
};

// 資本金(万円)・従業員数による適用判定。
// goods: 委託側 3億超→受託3億以下 / 1000万超〜3億→受託1000万以下 / 従業員300人超→300人以下
// service: 委託側 5000万超→受託5000万以下 / 1000万超〜5000万→受託1000万以下 / 従業員100人超→100人以下
export function judgeApplicability(i) {
  const t = TYPES[i.type];
  if (!t) return { result: 'unknown', reasons: ['取引の種類を選択してください。'] };
  const cc = num(i.clientCapital), cs = num(i.contractorCapital);
  const ce = num(i.clientEmployees), se = num(i.contractorEmployees);
  if ([cc, cs].some((v) => v === null)) {
    return { result: 'unknown', reasons: ['双方の資本金(個人事業主は0)を入力してください。'] };
  }
  const reasons = [];
  let hit = false;
  const [big, mid] = t.group === 'goods' ? [30000, 1000] : [5000, 1000];
  const empLimit = t.group === 'goods' ? 300 : 100;

  if (cc > big && cs <= big) { hit = true; reasons.push(`資本金基準: 委託側が${big}万円超、受託側が${big}万円以下。`); }
  else if (cc > mid && cc <= big && cs <= mid) { hit = true; reasons.push(`資本金基準: 委託側が${mid}万円超${big}万円以下、受託側が${mid}万円以下。`); }
  if (ce !== null && se !== null && ce > empLimit && se <= empLimit) {
    hit = true; reasons.push(`従業員数基準: 委託側が${empLimit}人超、受託側が${empLimit}人以下。`);
  }
  if (hit) return { result: 'yes', reasons };
  const empMissing = ce === null || se === null;
  return {
    result: empMissing ? 'maybe' : 'no',
    reasons: [empMissing
      ? '資本金基準には該当しませんでした。従業員数基準も確認するため、双方の従業員数を入力してください。'
      : '入力内容では取適法の適用基準に該当しませんでした。ただし、フリーランス保護法等の別の法律が適用される可能性があります。'],
  };
}

export const PRACTICES = [
  { id: 'refuse', label: '発注した物・成果物の受領を、受託側に責任がないのに拒否した', basis: '受領拒否の禁止' },
  { id: 'late', label: '受領日から60日を超えて支払っている(または超える予定がある)', basis: '支払遅延の禁止', auto: true },
  { id: 'reduce', label: '発注後に、受託側に責任がないのに代金を減額した(振込手数料の差引き含む)', basis: '代金減額の禁止' },
  { id: 'return', label: '受領後に、受託側に責任がないのに返品した', basis: '返品の禁止' },
  { id: 'lowball', label: '通常支払われる対価より著しく低い代金を一方的に決めた', basis: '買いたたきの禁止' },
  { id: 'nonegotiate', label: '原材料費・労務費等の上昇を理由とする価格協議を求められたが、応じず一方的に代金を決めた', basis: '協議に応じない一方的な代金決定の禁止' },
  { id: 'force', label: '正当な理由なく、自社指定の物・サービスの購入や利用を強制した', basis: '購入・利用強制の禁止' },
  { id: 'retaliate', label: '違反を公取委・中企庁等に知らせたことを理由に、取引停止などの不利益を与えた', basis: '報復措置の禁止' },
  { id: 'earlysettle', label: '有償支給した原材料等の代金を、その原材料を使った物の支払日より前に差し引いた', basis: '有償支給原材料等の対価の早期決済の禁止' },
  { id: 'benefit', label: '協賛金・従業員派遣など、受託側の利益にならない金銭・労務の提供を要請した', basis: '不当な経済上の利益の提供要請の禁止' },
  { id: 'rework', label: '費用を負担せず、発注内容の変更ややり直しをさせた', basis: '不当な給付内容の変更・やり直しの禁止' },
];

export const PAYMENT_METHODS = {
  transfer: { label: '銀行振込・現金', risk: 'ok' },
  bill: { label: '手形', risk: 'ng' },
  erc: { label: '電子記録債権(支払期日までに満期とならないもの)', risk: 'ng' },
  offset: { label: '一括決済方式(支払期日までに現金化できないもの)', risk: 'ng' },
};

// 戻り値: { applicability, findings[{level:'ng'|'warn'|'ok', title, detail}] }
export function evaluate(i) {
  const applicability = judgeApplicability(i);
  const findings = [];

  const days = num(i.paymentDays);
  if (days === null) {
    findings.push({ level: 'warn', title: '支払期日が未入力', detail: '受領日から支払日までの日数を入力してください。' });
  } else if (days > 60) {
    findings.push({ level: 'ng', title: `支払期日が受領日から${days}日後`, detail: '受領日(納品・検収ではなく受領日が原則)から60日以内の、できる限り短い期間内に支払日を定める必要があります。' });
  } else {
    findings.push({ level: 'ok', title: `支払期日が受領日から${days}日以内`, detail: '60日以内に収まっています。受領日起算である点(月末締め翌々月払い等で超えないか)は個別に確認してください。' });
  }

  const pm = PAYMENT_METHODS[i.paymentMethod];
  if (!pm) findings.push({ level: 'warn', title: '支払手段が未選択', detail: '支払手段を選択してください。' });
  else if (pm.risk === 'ng') findings.push({ level: 'ng', title: `支払手段が「${pm.label}」`, detail: '手形払い等、支払期日までに満額を現金化しにくい支払手段は原則として認められません。現金(銀行振込)への切替を検討してください。' });
  else findings.push({ level: 'ok', title: '支払手段が銀行振込・現金', detail: '問題となりにくい手段です。' });

  if (i.writtenTerms === 'no') {
    findings.push({ level: 'ng', title: '発注時の取引条件の明示がない', detail: '給付の内容、代金額、支払期日、支払方法などを、発注時に書面または電磁的方法(メール等)で明示する義務があります。' });
  } else if (i.writtenTerms === 'partial') {
    findings.push({ level: 'warn', title: '取引条件の明示が一部のみ', detail: '必要記載事項(給付内容・代金・支払期日・支払方法など)が漏れなく揃っているか確認してください。' });
  } else if (i.writtenTerms === 'yes') {
    findings.push({ level: 'ok', title: '取引条件を明示している', detail: '取引記録の作成・保存(2年間が一般的な目安)も併せて行ってください。' });
  }

  const checked = new Set(i.practices || []);
  for (const p of PRACTICES) {
    if (p.auto) continue;
    if (checked.has(p.id)) {
      findings.push({ level: 'ng', title: `違反の恐れ: ${p.basis}`, detail: p.label });
    }
  }
  return { applicability, findings };
}

export function summarize(res) {
  const ng = res.findings.filter((f) => f.level === 'ng').length;
  const warn = res.findings.filter((f) => f.level === 'warn').length;
  return { ng, warn, ok: res.findings.length - ng - warn };
}

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
