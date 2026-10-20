// 消費税(インボイス)納付税額の試算ロジック。副作用なし・DOM非依存。
// 税率は標準税率10%(国税7.8% + 地方消費税2.2%)のみ対応。軽減税率・複数事業区分は未対応。

export const SIMPLIFIED_CATEGORIES = {
  1: { label: "第1種 卸売業", rate: 0.9 },
  2: { label: "第2種 小売業等", rate: 0.8 },
  3: { label: "第3種 製造・建設業等", rate: 0.7 },
  4: { label: "第4種 飲食店業等", rate: 0.6 },
  5: { label: "第5種 サービス・運輸通信業等", rate: 0.5 },
  6: { label: "第6種 不動産業", rate: 0.4 },
};

export const TAX_RATE = 0.1;
const NATIONAL_SHARE = 78; // 国税分 7.8%
const LOCAL_SHARE = 22; // 地方消費税 2.2%

const floor100 = (n) => Math.floor(n / 100) * 100;

/** 税込金額から消費税額(10/110)を算出 */
export function taxPortion(taxIncluded) {
  return (taxIncluded * 10) / 110;
}

/** 納付税額(10%ベース)を国税・地方税に分解し、100円未満を切り捨てる。還付(負)は符号を反転して同じ規則を適用 */
export function splitTax(total) {
  if (total < 0) {
    const s = splitTax(-total);
    return { total: -s.total, national: -s.national, local: -s.local };
  }
  const national = floor100((total * NATIONAL_SHARE) / 100);
  const local = floor100((national * LOCAL_SHARE) / NATIONAL_SHARE);
  return { total: national + local, national, local };
}

/** 全角数字・カンマ・円記号を許容して数値化。空欄は0、解釈不能は NaN */
export function parseYen(text) {
  const s = String(text ?? "")
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，円¥\s]/g, "");
  if (s === "") return 0;
  return /^\d+$/.test(s) ? Number(s) : NaN;
}

export function validateInput(input) {
  const errors = [];
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  if (!num(input.sales) || input.sales < 0) errors.push("課税売上(税込)は0以上の数値で入力してください。");
  if (!num(input.purchases) || input.purchases < 0) errors.push("課税仕入(税込)は0以上の数値で入力してください。");
  if (!num(input.baseSales) || input.baseSales < 0) errors.push("基準期間の課税売上高は0以上の数値で入力してください。");
  if (!SIMPLIFIED_CATEGORIES[input.category]) errors.push("事業区分を選択してください。");
  if (![2026, 2027, 2028, 2029].includes(input.year)) errors.push("対象年を選択してください。");
  const MAX = 1e12;
  for (const k of ["sales", "purchases", "baseSales"]) {
    if (num(input[k]) && input[k] > MAX) errors.push("金額が大きすぎます(1兆円以下)。");
  }
  return errors;
}

/**
 * @param {{sales:number,purchases:number,baseSales:number,category:number,year:number}} input
 *   sales/purchases は税込。year: 2026=2割特例年, 2027-2028=3割特例(個人のみ), 2029=特例なし
 */
export function simulate(input) {
  const errors = validateInput(input);
  if (errors.length) return { errors, results: [] };

  // 実務の端数処理(切り捨て)に合わせ、税額は円未満を切り捨ててから以降の計算に使う
  const outputTax = Math.floor(taxPortion(input.sales));
  const inputTax = Math.floor(taxPortion(input.purchases));
  const cat = SIMPLIFIED_CATEGORIES[input.category];
  const results = [];

  // 本則課税
  {
    const raw = outputTax - inputTax;
    results.push({
      key: "standard",
      name: "本則課税",
      formula: "売上税額 − 仕入税額",
      eligible: true,
      notes: ["仕入税額控除にはインボイス(適格請求書)等の保存が必要です。経費の全額が控除対象とは限りません。", ...(raw < 0 ? ["控除不足のため還付となる試算です。"] : [])],
      ...splitTax(raw),
    });
  }

  // 簡易課税
  {
    const notes = ["事前に「簡易課税制度選択届出書」の提出が必要です。提出期限は国税庁で必ず確認してください。", "2年間の継続適用が必要です。"];
    const eligible = input.baseSales <= 50_000_000;
    if (!eligible) notes.unshift("基準期間の課税売上高が5,000万円を超えるため、簡易課税は利用できません。");
    results.push({
      key: "simplified",
      name: `簡易課税（${cat.label}・みなし仕入率${Math.round(cat.rate * 100)}%）`,
      formula: "売上税額 × (1 − みなし仕入率)",
      eligible,
      notes,
      ...splitTax(outputTax * (1 - cat.rate)),
    });
  }

  // 2割特例 / 3割特例
  if (input.year === 2026) {
    const eligible = input.baseSales <= 10_000_000;
    results.push({
      key: "special20",
      name: "2割特例(令和8年分が最終)",
      formula: "売上税額 × 20%",
      eligible,
      notes: [
        "事前届出は不要で、申告時に選択できます。",
        ...(eligible ? [] : ["基準期間の課税売上高が1,000万円を超えるため、原則として対象外です。"]),
        "インボイス登録を機に課税事業者となった事業者が対象です(登録なしの課税事業者は対象外)。",
      ],
      ...splitTax(outputTax * 0.2),
    });
  } else if (input.year === 2027 || input.year === 2028) {
    const eligible = input.baseSales <= 10_000_000;
    results.push({
      key: "special30",
      name: "3割特例(個人事業者のみ・令和9〜10年分)",
      formula: "売上税額 × 30%",
      eligible,
      notes: [
        "令和8年度税制改正で設けられた個人事業者向けの措置です。法人は対象外です。",
        "制度の詳細は法令成立後の国税庁の案内で必ず確認してください。",
        ...(eligible ? [] : ["基準期間の課税売上高が1,000万円を超えるため、原則として対象外です。"]),
      ],
      ...splitTax(outputTax * 0.3),
    });
  }

  const candidates = results.filter((r) => r.eligible);
  let best = null;
  for (const r of candidates) if (!best || r.total < best.total) best = r;
  for (const r of results) r.isBest = best !== null && r.key === best.key;

  return { errors: [], results, outputTax, inputTax };
}
