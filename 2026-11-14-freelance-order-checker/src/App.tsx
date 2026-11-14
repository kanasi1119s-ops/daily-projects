import { useMemo, useState } from 'react';
import { emptyForm, OrderForm, validate, judgeApplicability, buildOrderText, PROHIBITED_ITEMS, ApplicabilityInput } from './lib/check';

type Tri = boolean | null;
function YesNo({ label, value, onChange }: { label: string; value: Tri; onChange: (v: boolean) => void }) {
  return (
    <fieldset className="q"><legend>{label}</legend>
      <label><input type="radio" checked={value === true} onChange={() => onChange(true)} />はい</label>
      <label><input type="radio" checked={value === false} onChange={() => onChange(false)} />いいえ</label>
    </fieldset>
  );
}

export default function App() {
  const [a, setA] = useState<ApplicabilityInput>({ clientHasEmployees: null, freelancerHasEmployees: null, isBusinessToBusiness: null });
  const [f, setF] = useState<OrderForm>(emptyForm);
  const [checked, setChecked] = useState<boolean[]>(PROHIBITED_ITEMS.map(() => false));
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const app = judgeApplicability(a);
  const findings = useMemo(() => validate(f), [f]);
  const errors = findings.filter(x => x.severity === 'error');
  const set = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) => { setF(p => ({ ...p, [k]: v })); setTouched(t => new Set(t).add(k)); };
  const msg = (k: keyof OrderForm) => findings.filter(x => x.field === k && (showAll || touched.has(k))).map((x, i) => <p key={i} className={x.severity}>{x.message}</p>);
  const text = buildOrderText(f);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('コピーしてください', text); }
  };

  return (
    <main>
      <h1>発注明示チェッカー</h1>
      <p className="lead">フリーランスへ業務委託するときの「取引条件の明示」漏れを確認し、発注書テキストを作れます。入力内容はブラウザ内で処理され、外部へ送信されません。</p>
      <p className="disclaimer">※ 一般的な情報提供であり、法的助言ではありません。個別の判断は公正取引委員会の相談窓口や専門家にご確認ください。</p>

      <section>
        <h2>1. 対象になるかの目安</h2>
        <YesNo label="事業者間（消費者向けでない）の業務委託ですか？" value={a.isBusinessToBusiness} onChange={v => setA({ ...a, isBusinessToBusiness: v })} />
        <YesNo label="受注側（フリーランス）は従業員を使用していますか？" value={a.freelancerHasEmployees} onChange={v => setA({ ...a, freelancerHasEmployees: v })} />
        <YesNo label="発注側（あなた）は従業員を使用していますか？（法人で役員2名以上の場合も「はい」）" value={a.clientHasEmployees} onChange={v => setA({ ...a, clientHasEmployees: v })} />
        <p className={'result ' + app.result} role="status">{app.note}</p>
      </section>

      <section>
        <h2>2. 取引条件の入力</h2>
        <label>発注事業者の名称<input value={f.clientName} onChange={e => set('clientName', e.target.value)} /></label>{msg('clientName')}
        <label>フリーランスの名称<input value={f.freelancerName} onChange={e => set('freelancerName', e.target.value)} /></label>{msg('freelancerName')}
        <label>業務委託をした日<input type="date" value={f.orderDate} onChange={e => set('orderDate', e.target.value)} /></label>{msg('orderDate')}
        <label>業務内容（給付の内容）<textarea value={f.content} onChange={e => set('content', e.target.value)} /></label>{msg('content')}
        <label>納期（給付を受領する期日）<input type="date" value={f.deliveryDate} onChange={e => set('deliveryDate', e.target.value)} /></label>{msg('deliveryDate')}
        <label>納品先・納品方法<input value={f.deliveryPlace} onChange={e => set('deliveryPlace', e.target.value)} placeholder="例: メールで納品" /></label>{msg('deliveryPlace')}
        <label>検査をしますか？
          <select value={f.inspection} onChange={e => set('inspection', e.target.value as 'yes' | 'no')}><option value="no">しない</option><option value="yes">する</option></select>
        </label>
        {f.inspection === 'yes' && <><label>検査完了日<input type="date" value={f.inspectionDate} onChange={e => set('inspectionDate', e.target.value)} /></label>{msg('inspectionDate')}</>}
        <label>報酬の額（または算定方法）<input aria-invalid={validate(f).some(x => x.field === 'fee' && (showAll || touched.has('fee')))} value={f.fee} onChange={e => set('fee', e.target.value)} placeholder="例: 100,000円 / 単価3,000円×40時間" /></label>{msg('fee')}
        <label>支払期日<input type="date" value={f.paymentDate} onChange={e => set('paymentDate', e.target.value)} /></label>{msg('paymentDate')}
        <label className="inline"><input type="checkbox" checked={f.paymentIsCash} onChange={e => set('paymentIsCash', e.target.checked)} />現金（銀行振込）で支払う</label>
        {!f.paymentIsCash && <><label>支払方法の詳細<input value={f.paymentMethod} onChange={e => set('paymentMethod', e.target.value)} /></label>{msg('paymentMethod')}</>}
      </section>

      <section aria-live="polite">
        <h2>3. チェック結果</h2>
        {errors.length === 0 ? <p className="result applies">必須項目の入力チェックは通りました。内容の正確性は発注者ご自身でご確認ください。</p>
          : <p className="result not-applies">要修正: {errors.length}件（上の入力欄の赤字をご確認ください）</p>}
        <button onClick={() => setShowAll(true)}>全項目をチェック</button>
      </section>

      <section>
        <h2>4. 禁止行為セルフチェック（1か月以上の委託の場合）</h2>
        <p className="note">次のような行為をしていない／しない予定であることを確認してください（該当する場合は見直しを）。</p>
        <ul className="plain">{PROHIBITED_ITEMS.map((t, i) => (
          <li key={i}><label className="inline"><input type="checkbox" checked={checked[i]} onChange={() => setChecked(c => c.map((v, j) => j === i ? !v : v))} />{t}</label></li>
        ))}</ul>
        <p>{checked.filter(Boolean).length}/{PROHIBITED_ITEMS.length} 確認済み</p>
      </section>

      <section>
        <h2>5. 発注書テキスト</h2>
        <pre>{text}</pre>
        <button onClick={copy} disabled={errors.length > 0}>{copied ? 'コピーしました' : 'テキストをコピー'}</button>
        <button onClick={() => window.print()} disabled={errors.length > 0}>印刷／PDF保存</button>
        {errors.length > 0 && <p className="note">エラーが解消されるとコピー・印刷できます。</p>}
      </section>

      <footer>
        <p>参考: <a href="https://www.jftc.go.jp/freelancelaw_2026/index.html" target="_blank" rel="noreferrer">公正取引委員会 フリーランス法特設サイト</a></p>
      </footer>
    </main>
  );
}
