/** 発注側の禁止行為・義務のセルフチェック項目。 */
export interface CheckItem {
  id: string;
  title: string;
  question: string;
  /** 「はい」と答えると問題になり得るか（true）／「いいえ」で問題か（false） */
  riskyWhen: boolean;
  newIn2026?: boolean;
  advice: string;
}

export const CHECK_ITEMS: CheckItem[] = [
  {
    id: 'no-consult',
    title: '協議に応じない一方的な代金決定',
    question: '受注側から価格協議の求めがあったのに、協議に応じない／必要な説明をせず代金を決めたことがある。',
    riskyWhen: true,
    newIn2026: true,
    advice: '労務費・原材料費・エネルギー費の上昇などを理由とする協議の求めには応じ、必要な説明・情報提供を行い、記録を残しましょう。',
  },
  {
    id: 'bill',
    title: '手形払等の利用',
    question: '代金の支払に手形、または支払期日までに満額の現金化が困難な方法（長いサイトの電子記録債権等）を使っている。',
    riskyWhen: true,
    newIn2026: true,
    advice: '支払手段は原則として現金（銀行振込等）に切り替える方向で検討してください。',
  },
  {
    id: 'fee',
    title: '振込手数料の負担',
    question: '代金の振込手数料を受注側負担として差し引いている（事前合意があっても同様）。',
    riskyWhen: true,
    advice: '振込手数料は発注側が負担し、代金から差し引かないようにしてください。',
  },
  {
    id: 'late',
    title: '支払遅延',
    question: '物品等を受領した日から60日以内に代金を支払っていない取引がある。',
    riskyWhen: true,
    advice: '「支払期日」タブで受領日・支払条件を確認し、60日以内に収まるよう締め日・支払日を見直してください。',
  },
  {
    id: 'cut',
    title: '代金の減額',
    question: '発注後に、受注側の責めに帰すべき理由がないのに代金を減額した（協賛金・歩引き等の名目含む）。',
    riskyWhen: true,
    advice: '発注時に決めた代金の減額は原則できません。',
  },
  {
    id: 'lowball',
    title: '買いたたき',
    question: '通常支払われる対価に比べて著しく低い代金を、一方的に決めた。',
    riskyWhen: true,
    advice: '原価や市況を踏まえ、協議のうえで代金を決めた記録を残しましょう。',
  },
  {
    id: 'refuse',
    title: '受領拒否',
    question: '受注側に責任がないのに、注文した物品等の受領を拒んだ。',
    riskyWhen: true,
    advice: '発注の取消し・納期延期を一方的に行う場合も問題になり得ます。',
  },
  {
    id: 'return',
    title: '返品',
    question: '受領後、受注側に責任がないのに商品を引き取らせた（返品した）。',
    riskyWhen: true,
    advice: '不良品など受注側の責めに帰すべき場合を除き、返品は避けてください。',
  },
  {
    id: 'redo',
    title: '不当なやり直し・給付内容の変更',
    question: '費用を負担せずに、受領後のやり直しや発注内容の変更を求めた。',
    riskyWhen: true,
    advice: 'やり直し等が発注側の都合による場合は、費用を発注側が負担してください。',
  },
  {
    id: 'benefit',
    title: '不当な経済上の利益の提供要請',
    question: '協賛金の提供、無償の人員派遣、金型等の無償保管などを要請した。',
    riskyWhen: true,
    advice: '受注側の利益を不当に害する要請は避けてください。',
  },
  {
    id: 'forced',
    title: '購入・利用強制',
    question: '正当な理由なく、指定する物品の購入やサービスの利用を強制した。',
    riskyWhen: true,
    advice: '自社製品や指定サービスの購入を取引の条件にしないでください。',
  },
  {
    id: 'retaliate',
    title: '報復措置',
    question: '受注側が公正取引委員会等に申告したことを理由に、取引停止や数量削減をした。',
    riskyWhen: true,
    advice: '申告を理由とする不利益な取扱いは禁止されています。',
  },
  {
    id: 'written',
    title: '取引条件の明示（書面・電磁的方法）',
    question: '発注時に、代金額・支払期日・給付内容などを書面またはメール等で明示している。',
    riskyWhen: false,
    advice: '発注の都度、必要記載事項を明示し、書類を保存してください。',
  },
];

export type Answer = 'yes' | 'no' | undefined;

export interface ChecklistSummary {
  risky: CheckItem[];
  unanswered: number;
  answered: number;
}

export function summarize(answers: Record<string, Answer>): ChecklistSummary {
  const risky: CheckItem[] = [];
  let unanswered = 0;
  for (const it of CHECK_ITEMS) {
    const a = answers[it.id];
    if (a === undefined) {
      unanswered++;
      continue;
    }
    if ((a === 'yes') === it.riskyWhen) risky.push(it);
  }
  return { risky, unanswered, answered: CHECK_ITEMS.length - unanswered };
}
