import { useMemo, useState } from 'react';
import { NoticeInput, buildNoticeText, calcPaymentLimit, emptyInput, toJa, validate } from './lib/notice';

export default function App() {
  const [v, setV] = useState<NoticeInput>(emptyInput());
  const [copied, setCopied] = useState(false);
  const set = <K extends keyof NoticeInput>(k: K, val: NoticeInput[K]) => setV((p) => ({ ...p, [k]: val }));

  const issues = useMemo(() => validate(v), [v]);
  const text = useMemo(() => buildNoticeText(v), [v]);
  const limit = calcPaymentLimit(v.deliveryDate, v.isSubcontract, v.monthlyClosing);
  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity === 'warn');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('コピーしてください', text);
    }
  };

  return (
    <div className="wrap">
      <header className="no-print">
        <h1>発注明示くん</h1>
        <p>フリーランス取引適正化法の「取引条件の明示」項目を漏れなく入力し、支払期日（60日ルール）を自動チェックします。入力内容はこのブラウザ内でのみ処理され、送信・保存されません。</p>
      </header>

      <div className="grid">
        <form className="no-print" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>当事者</legend>
            <label>発注者（委託事業者）名<input value={v.clientName} onChange={(e) => set('clientName', e.target.value)} /></label>
            <label>発注者の連絡先（任意）<input value={v.clientContact} onChange={(e) => set('clientContact', e.target.value)} /></label>
            <label>フリーランス（受託者）名<input value={v.freelancerName} onChange={(e) => set('freelancerName', e.target.value)} /></label>
            <label className="chk"><input type="checkbox" checked={v.isSubcontract} onChange={(e) => set('isSubcontract', e.target.checked)} />元請からの再委託である（支払期日の上限が30日になります）</label>
          </fieldset>

          <fieldset>
            <legend>業務内容・納期</legend>
            <label>業務委託をした日<input type="date" value={v.orderDate} onChange={(e) => set('orderDate', e.target.value)} /></label>
            <label>給付の内容（業務内容）<textarea rows={3} value={v.description} onChange={(e) => set('description', e.target.value)} /></label>
            <label>納期（給付を受領する日／役務提供を受ける日）<input type="date" value={v.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} /></label>
            <label>受領・提供場所<input value={v.deliveryPlace} onChange={(e) => set('deliveryPlace', e.target.value)} placeholder="例: メールで納品 / 発注者オフィス" /></label>
            <label className="chk"><input type="checkbox" checked={v.hasInspection} onChange={(e) => set('hasInspection', e.target.checked)} />検査を行う</label>
            {v.hasInspection && (
              <label>検査完了日<input type="date" value={v.inspectionDate} onChange={(e) => set('inspectionDate', e.target.value)} /></label>
            )}
          </fieldset>

          <fieldset>
            <legend>報酬・支払</legend>
            <div className="row">
              <label className="chk"><input type="radio" name="ft" checked={v.feeType === 'fixed'} onChange={() => set('feeType', 'fixed')} />金額が確定</label>
              <label className="chk"><input type="radio" name="ft" checked={v.feeType === 'formula'} onChange={() => set('feeType', 'formula')} />算定方法で定める</label>
            </div>
            {v.feeType === 'fixed' ? (
              <>
                <label>報酬額（円）<input inputMode="numeric" value={v.feeAmount} onChange={(e) => set('feeAmount', e.target.value)} /></label>
                <div className="row">
                  <label className="chk"><input type="radio" name="tx" checked={v.feeTax === 'excl'} onChange={() => set('feeTax', 'excl')} />税別</label>
                  <label className="chk"><input type="radio" name="tx" checked={v.feeTax === 'incl'} onChange={() => set('feeTax', 'incl')} />税込</label>
                </div>
              </>
            ) : (
              <label>報酬の具体的な算定方法<textarea rows={2} value={v.feeFormula} onChange={(e) => set('feeFormula', e.target.value)} placeholder="例: 作業時間×時給3,000円（税別）" /></label>
            )}
            <label className="chk"><input type="checkbox" checked={v.monthlyClosing} onChange={(e) => set('monthlyClosing', e.target.checked)} />月単位の締切制度を採用（要確認の簡易扱い）</label>
            {limit && <p className="hint">支払期日の上限の目安: <strong>{toJa(limit)}</strong></p>}
            <label>支払期日<input type="date" value={v.paymentDate} onChange={(e) => set('paymentDate', e.target.value)} /></label>
            <label>支払方法
              <select value={v.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value as 'bank' | 'other')}>
                <option value="bank">銀行口座への振込</option>
                <option value="other">その他（現金・電子マネー等）</option>
              </select>
            </label>
            {v.paymentMethod === 'other' && (
              <label>支払方法の詳細<input value={v.paymentMethodNote} onChange={(e) => set('paymentMethodNote', e.target.value)} /></label>
            )}
          </fieldset>
          <button type="button" className="ghost" onClick={() => setV(emptyInput())}>入力をクリア</button>
        </form>

        <section>
          <div className="no-print" aria-live="polite">
            <h2>チェック結果</h2>
            {issues.length === 0 ? (
              <p className="ok">✅ 指摘事項はありません（雛形としてのチェックです）</p>
            ) : (
              <ul className="issues">
                {errors.map((i, n) => <li key={'e' + n} className="err">❌ {i.message}</li>)}
                {warns.map((i, n) => <li key={'w' + n} className="warn">⚠️ {i.message}</li>)}
              </ul>
            )}
          </div>
          <h2 className="no-print">明示書プレビュー</h2>
          <pre className="preview">{text}</pre>
          <div className="row no-print">
            <button type="button" onClick={copy}>{copied ? 'コピーしました' : 'テキストをコピー'}</button>
            <button type="button" onClick={() => window.print()}>印刷 / PDF保存</button>
          </div>
        </section>
      </div>

      <footer className="no-print">
        <p>※ 本ツールは情報提供を目的とした雛形作成ツールであり、法的助言ではありません。個別の取引への適用は公正取引委員会・厚生労働省の公表資料や専門家にご確認ください。電磁的方法で明示した場合も、フリーランスから書面交付を求められたときは対応が必要になる場合があります。</p>
      </footer>
    </div>
  );
}
