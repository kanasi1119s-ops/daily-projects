import { useState } from 'react';
import { checkPayment, paymentDeadline, formatDate, worstCaseDays, type Terms } from '../lib/payment';

export function PaymentTab() {
  const [receipt, setReceipt] = useState('');
  const [pay, setPay] = useState('');
  const [terms, setTerms] = useState<Terms>({ closingDay: 0, monthsLater: 1, payDay: 0 });

  const dl = receipt ? paymentDeadline(receipt) : null;
  const chk = receipt && pay ? checkPayment(receipt, pay) : null;
  const worst = worstCaseDays(terms);

  const dayOpts = (zeroLabel: string) => [
    <option key={0} value={0}>
      {zeroLabel}
    </option>,
    ...Array.from({ length: 28 }, (_, i) => (
      <option key={i + 1} value={i + 1}>
        {i + 1}日
      </option>
    )),
  ];

  return (
    <section aria-labelledby="t2">
      <h2 id="t2">支払期日（受領日から60日以内）</h2>

      <h3>個別の取引を確認</h3>
      <div className="grid">
        <label>
          物品等の受領日（納品日）
          <input type="date" value={receipt} onChange={(e) => setReceipt(e.target.value)} />
        </label>
        <label>
          支払予定日
          <input type="date" value={pay} onChange={(e) => setPay(e.target.value)} />
        </label>
      </div>
      {dl !== null && <p>支払の期限（受領日を1日目として60日目）：<strong>{formatDate(dl)}</strong></p>}
      {chk && (
        <div className={`result ${chk.ok ? 'applies-ok' : 'not_ok'}`} role="status" aria-live="polite">
          <strong>{chk.ok ? '期限内' : '期限超過のおそれ'}</strong>
          <p>{chk.message}</p>
        </div>
      )}
      <p className="note">起算は「検収日」ではなく「受領日」です。受領日を1日目として数える安全側の計算です。</p>

      <h3>締め日・支払サイトの運用を確認</h3>
      <div className="grid3">
        <label>
          締め日
          <select value={terms.closingDay} onChange={(e) => setTerms({ ...terms, closingDay: Number(e.target.value) })}>
            {dayOpts('月末')}
          </select>
        </label>
        <label>
          支払月
          <select value={terms.monthsLater} onChange={(e) => setTerms({ ...terms, monthsLater: Number(e.target.value) })}>
            <option value={0}>当月</option>
            <option value={1}>翌月</option>
            <option value={2}>翌々月</option>
          </select>
        </label>
        <label>
          支払日
          <select value={terms.payDay} onChange={(e) => setTerms({ ...terms, payDay: Number(e.target.value) })}>
            {dayOpts('月末')}
          </select>
        </label>
      </div>
      <div className={`result ${worst.ok ? 'applies-ok' : 'not_ok'}`} role="status" aria-live="polite">
        <strong>{worst.ok ? '最悪ケースでも60日以内' : '最悪ケースで60日を超えます'}</strong>
        <p>
          受領日が締め日の直後になる場合、受領から支払まで最大{worst.worstDays}日（例：{worst.worstReceipt}受領分）。
        </p>
        <p className="note">支払日が金融機関の休業日の場合の扱い（前倒し等）は、取引条件に沿って別途確認してください。</p>
      </div>
    </section>
  );
}
