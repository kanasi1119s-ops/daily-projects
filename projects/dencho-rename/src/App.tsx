import { useMemo, useState } from 'react';
import { buildAll, buildIndexCsv, defaultOptions, guessFromFilename, validate, type Entry, type Options } from './naming';
import { makeZip } from './zip';

interface Row extends Entry { file: File; id: number }
let seq = 0;

export function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [opt, setOpt] = useState<Options>(defaultOptions);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const totalMB = rows.reduce((a, r) => a + r.file.size, 0) / 1048576;

  const names = useMemo(() => buildAll(rows, opt), [rows, opt]);
  const okCount = names.filter((n) => n !== null).length;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const add: Row[] = Array.from(list).map((f) => ({
      id: ++seq, file: f, original: f.name, date: '', partner: '', amount: '', note: '', ...guessFromFilename(f.name),
    }));
    setRows((r) => [...r, ...add]);
  };
  const upd = (id: number, patch: Partial<Entry>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const fillFromFirst = () =>
    setRows((r) => {
      if (r.length < 2) return r;
      const f = r[0];
      return r.map((x, i) => i === 0 ? x : { ...x, date: x.date || f.date, partner: x.partner || f.partner, amount: x.amount || f.amount, note: x.note || f.note });
    });
  const del = (id: number) => setRows((r) => r.filter((x) => x.id !== id));

  const download = async () => {
    setBusy(true);
    try {
      const files: { name: string; data: Uint8Array }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const n = names[i];
        if (n === null) continue;
        files.push({ name: n, data: new Uint8Array(await rows[i].file.arrayBuffer()) });
      }
      const blob = await makeZip(files, buildIndexCsv(rows, names));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'renamed.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } finally { setBusy(false); }
  };

  return (
    <main>
      <h1>電帳法ファイル名ツール</h1>
      <p className="lead">請求書・領収書などのファイルを「取引年月日・取引先・取引金額」入りの名前に一括リネームし、索引簿CSVと一緒にZIPで保存します。</p>
      <p className="privacy">🔒 ファイルはこのブラウザの中だけで処理され、外部へ送信されません。</p>

      <label
        className={'drop' + (over ? ' over' : '')}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
      >
        ここにファイルをドロップ、またはクリックして選択（複数可）
        <input type="file" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
      </label>

      <fieldset className="opts">
        <legend>命名ルール</legend>
        <label>区切り
          <select value={opt.separator} onChange={(e) => setOpt({ ...opt, separator: e.target.value as Options['separator'] })}>
            <option value="_">_ (アンダースコア)</option><option value="-">- (ハイフン)</option>
          </select></label>
        <label><input type="checkbox" checked={opt.compactDate} onChange={(e) => setOpt({ ...opt, compactDate: e.target.checked })} />日付を20261109形式に</label>
        <label><input type="checkbox" checked={opt.includeNote} onChange={(e) => setOpt({ ...opt, includeNote: e.target.checked })} />メモ(書類種別等)を末尾に付ける</label>
      </fieldset>

      {rows.length > 1 && <button onClick={fillFromFirst}>1行目の値を空欄の行へ反映</button>}
      {rows.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead><tr><th>元ファイル</th><th>取引年月日</th><th>取引先</th><th>金額(円)</th><th>メモ</th><th>新ファイル名</th><th></th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const errs = validate(r);
                return (
                  <tr key={r.id} className={errs.length ? 'bad' : ''}>
                    <td className="orig">{r.original}</td>
                    <td><input type="date" value={r.date} onChange={(e) => upd(r.id, { date: e.target.value })} aria-label="取引年月日" /></td>
                    <td><input value={r.partner} onChange={(e) => upd(r.id, { partner: e.target.value })} aria-label="取引先" /></td>
                    <td><input inputMode="numeric" value={r.amount} onChange={(e) => upd(r.id, { amount: e.target.value })} aria-label="金額" /></td>
                    <td><input value={r.note} onChange={(e) => upd(r.id, { note: e.target.value })} aria-label="メモ" /></td>
                    <td className="newname">{names[i] ?? <span className="err">{errs.join(' / ')}</span>}</td>
                    <td><button onClick={() => del(r.id)} aria-label="削除">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalMB > 300 && <p className="err">合計 {Math.round(totalMB)}MB です。ブラウザのメモリ不足を避けるため、数回に分けて処理してください。</p>}
      <button className="primary" disabled={okCount === 0 || busy} onClick={download}>
        {busy ? '作成中…' : `ZIPをダウンロード（${okCount}/${rows.length}件）`}
      </button>
      {rows.length > okCount && <p className="err">未入力・不正な行はZIPに含まれません。</p>}

      <footer>
        <p>本ツールはファイル名整理の補助であり、税務・法律上の助言ではありません。電子帳簿保存法の要件への適合は、国税庁の公式資料または税理士等にご確認ください。</p>
      </footer>
    </main>
  );
}
