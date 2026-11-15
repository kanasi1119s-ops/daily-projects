import { useState } from 'react';
import { TRADE_TYPES, judgeApplicability, type TradeType } from '../lib/applicability';

function num(s: string): number {
  if (s.trim() === '') return NaN;
  return Number(s);
}

export function ApplicabilityTab() {
  const [type, setType] = useState<TradeType>('program');
  const [cc, setCc] = useState('10000');
  const [ce, setCe] = useState('50');
  const [kc, setKc] = useState('0');
  const [ke, setKe] = useState('1');

  const j = judgeApplicability(
    type,
    { capital: num(cc), employees: num(ce) },
    { capital: num(kc), employees: num(ke) },
  );

  return (
    <section aria-labelledby="t1">
      <h2 id="t1">取適法の対象になるか（目安）</h2>
      <label>
        取引の種類
        <select value={type} onChange={(e) => setType(e.target.value as TradeType)}>
          {TRADE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{TRADE_TYPES.find((t) => t.value === type)!.example}</p>

      <div className="grid">
        <fieldset>
          <legend>発注する側（委託事業者）</legend>
          <label>
            資本金（万円）
            <input type="number" min="0" inputMode="numeric" value={cc} onChange={(e) => setCc(e.target.value)} />
          </label>
          <label>
            従業員数（人）
            <input type="number" min="0" inputMode="numeric" value={ce} onChange={(e) => setCe(e.target.value)} />
          </label>
        </fieldset>
        <fieldset>
          <legend>受注する側（中小受託事業者）</legend>
          <label>
            資本金（万円・個人は0）
            <input type="number" min="0" inputMode="numeric" value={kc} onChange={(e) => setKc(e.target.value)} />
          </label>
          <label>
            従業員数（人）
            <input type="number" min="0" inputMode="numeric" value={ke} onChange={(e) => setKe(e.target.value)} />
          </label>
        </fieldset>
      </div>

      <div className={`result ${j.status}`} role="status" aria-live="polite">
        <strong>{j.headline}</strong>
        <ul>
          {j.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {j.notes.map((n) => (
          <p className="note" key={n}>
            {n}
          </p>
        ))}
      </div>
    </section>
  );
}
