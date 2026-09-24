import { useMemo, useState } from 'react'
import './App.css'
import { calculateKabeLines, summarize, type EmployerSize } from './logic/kabeCalculator'

const statusLabel: Record<string, string> = {
  clear: '余裕あり',
  near: '注意',
  over: '超過',
}

function App() {
  const [annualIncome, setAnnualIncomeState] = useState(100)
  const setAnnualIncome = (value: number) => setAnnualIncomeState(Number.isFinite(value) ? Math.max(0, value) : 0)
  const [isStudent, setIsStudent] = useState(false)
  const [employerSize, setEmployerSize] = useState<EmployerSize>('under100')

  const lines = useMemo(
    () => calculateKabeLines({ annualIncome, isStudent, employerSize }),
    [annualIncome, isStudent, employerSize],
  )
  const summary = useMemo(() => summarize(lines), [lines])

  return (
    <div className="page">
      <header className="hero">
        <h1>年収の壁 かんたんシミュレーター</h1>
        <p>2026年10月の制度改正（106万円の壁撤廃・130万円の要件変更）に対応した、パート・アルバイト向けの目安チェックツールです。</p>
      </header>

      <section className="form-card">
        <label className="field">
          <span>想定年収（万円）</span>
          <input
            type="number"
            min={0}
            max={500}
            value={annualIncome}
            onChange={(e) => setAnnualIncome(Number(e.target.value))}
          />
          <input
            type="range"
            min={0}
            max={300}
            value={Math.min(annualIncome, 300)}
            onChange={(e) => setAnnualIncome(Number(e.target.value))}
          />
        </label>

        <label className="field checkbox">
          <input type="checkbox" checked={isStudent} onChange={(e) => setIsStudent(e.target.checked)} />
          <span>学生である（勤労学生控除の対象を想定）</span>
        </label>

        <label className="field">
          <span>勤務先の従業員規模</span>
          <select value={employerSize} onChange={(e) => setEmployerSize(e.target.value as EmployerSize)}>
            <option value="under100">100人以下</option>
            <option value="over100">101人以上</option>
          </select>
        </label>
      </section>

      <section className="summary-card">
        <p>{summary}</p>
      </section>

      <section className="lines">
        {lines.map((line) => (
          <div key={line.key} className={`line-card status-${line.status}`}>
            <div className="line-card-header">
              <strong>{line.label}</strong>
              <span className={`badge badge-${line.status}`}>{statusLabel[line.status]}</span>
            </div>
            <p className="threshold">目安ライン: {line.thresholdManYen}万円 / あなたの想定年収: {annualIncome}万円</p>
            <p className="description">{line.description}</p>
          </div>
        ))}
      </section>

      <footer className="disclaimer">
        <p>
          ※本ツールは2026年9月時点の公開情報をもとにした概算シミュレーションであり、税務・社会保険の正式な判定を行うものではありません。
          実際の制度適用は自治体・勤務先・保険組合等により異なるため、最終判断は税理士・社会保険労務士や勤務先の担当窓口にご確認ください。
          入力した情報はサーバーに送信・保存されず、お使いのブラウザ内でのみ計算されます。
        </p>
      </footer>
    </div>
  )
}

export default App
