import { CHECK_ITEMS, summarize, type Answer } from '../lib/checklist';

interface Props {
  answers: Record<string, Answer>;
  setAnswers: (a: Record<string, Answer>) => void;
}

export function ChecklistTab({ answers, setAnswers }: Props) {
  const s = summarize(answers);
  const set = (id: string, v: Answer) => setAnswers({ ...answers, [id]: v });

  return (
    <section aria-labelledby="t3">
      <h2 id="t3">禁止行為セルフチェック（発注側）</h2>
      <p className="hint">自社の運用にあてはまるかを選んでください。回答はこのブラウザ内だけで処理され、送信・保存されません。</p>
      <ol className="checks">
        {CHECK_ITEMS.map((it) => {
          const a = answers[it.id];
          const risky = a !== undefined && (a === 'yes') === it.riskyWhen;
          return (
            <li key={it.id} className={risky ? 'risky' : ''}>
              <div className="ctitle">
                {it.title}
                {it.newIn2026 && <span className="badge">2026年新設</span>}
              </div>
              <p>{it.question}</p>
              <div className="radios" role="radiogroup" aria-label={it.title}>
                <label>
                  <input type="radio" name={it.id} checked={a === 'yes'} onChange={() => set(it.id, 'yes')} />
                  はい
                </label>
                <label>
                  <input type="radio" name={it.id} checked={a === 'no'} onChange={() => set(it.id, 'no')} />
                  いいえ
                </label>
              </div>
              {risky && <p className="advice">⚠ {it.advice}</p>}
            </li>
          );
        })}
      </ol>
      <div className={`result ${s.risky.length ? 'not_ok' : 'applies-ok'}`} role="status" aria-live="polite">
        <strong>
          回答 {s.answered}/{CHECK_ITEMS.length} ・ 要確認 {s.risky.length}件
        </strong>
        {s.risky.length > 0 && (
          <ul>
            {s.risky.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        )}
        {s.unanswered > 0 && <p className="note">未回答が{s.unanswered}件あります。</p>}
      </div>
      <button type="button" className="ghost" onClick={() => setAnswers({})}>
        回答をリセット
      </button>
    </section>
  );
}
