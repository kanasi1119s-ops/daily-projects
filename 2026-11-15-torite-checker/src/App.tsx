import { useState } from 'react';
import { ApplicabilityTab } from './components/ApplicabilityTab';
import { PaymentTab } from './components/PaymentTab';
import { ChecklistTab } from './components/ChecklistTab';
import type { Answer } from './lib/checklist';

const TABS = [
  { id: 'app', label: '① 対象判定' },
  { id: 'pay', label: '② 支払期日' },
  { id: 'chk', label: '③ 禁止行為' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function App() {
  const [tab, setTab] = useState<TabId>('app');
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  return (
    <div className="wrap">
      <header>
        <h1>取適チェッカー</h1>
        <p>中小受託取引適正化法（取適法・旧下請法）のセルフチェック。ブラウザ内だけで動作し、入力内容は送信・保存されません。</p>
      </header>

      <div
        className="tabs"
        role="tablist"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const i = TABS.findIndex((t) => t.id === tab);
          const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
          setTab(n);
          document.getElementById(`tab-${n}`)?.focus();
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {TABS.map((t) => (
        <main key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={tab !== t.id}>
          {t.id === 'app' && <ApplicabilityTab />}
          {t.id === 'pay' && <PaymentTab />}
          {t.id === 'chk' && <ChecklistTab answers={answers} setAnswers={setAnswers} />}
        </main>
      ))}

      <footer>
        <p>
          <strong>ご注意：</strong>本ツールは公開情報に基づく一般的な目安を示すもので、法的助言ではありません。個別の取引の適法性は、公正取引委員会・中小企業庁の公式情報または弁護士等の専門家にご確認ください。結果について当方は責任を負いません。
        </p>
      </footer>
    </div>
  );
}
