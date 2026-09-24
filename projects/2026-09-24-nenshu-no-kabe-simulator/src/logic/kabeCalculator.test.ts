import { describe, expect, it } from 'vitest'
import { calculateKabeLines, summarize } from './kabeCalculator'

describe('calculateKabeLines', () => {
  it('marks all lines as clear for a low income', () => {
    const lines = calculateKabeLines({ annualIncome: 50, isStudent: false, employerSize: 'under100' })
    expect(lines.every((l) => l.status === 'clear')).toBe(true)
  })

  it('marks the 130万円 line as over when income exceeds it', () => {
    const lines = calculateKabeLines({ annualIncome: 140, isStudent: false, employerSize: 'under100' })
    const line = lines.find((l) => l.key === 'social-insurance-130')
    expect(line?.status).toBe('over')
  })

  it('includes the 106万円 line only for employers with 100+ staff', () => {
    const withLargeEmployer = calculateKabeLines({ annualIncome: 100, isStudent: false, employerSize: 'over100' })
    const withSmallEmployer = calculateKabeLines({ annualIncome: 100, isStudent: false, employerSize: 'under100' })
    expect(withLargeEmployer.some((l) => l.key === 'social-insurance-106')).toBe(true)
    expect(withSmallEmployer.some((l) => l.key === 'social-insurance-106')).toBe(false)
  })

  it('uses the student income tax threshold when isStudent is true', () => {
    const lines = calculateKabeLines({ annualIncome: 140, isStudent: true, employerSize: 'under100' })
    const line = lines.find((l) => l.key === 'income-tax')
    expect(line?.thresholdManYen).toBe(150)
  })

  it('returns lines sorted by threshold ascending', () => {
    const lines = calculateKabeLines({ annualIncome: 200, isStudent: false, employerSize: 'over100' })
    const thresholds = lines.map((l) => l.thresholdManYen)
    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b))
  })
})

describe('calculateKabeLines edge cases', () => {
  it('handles zero income without throwing', () => {
    const lines = calculateKabeLines({ annualIncome: 0, isStudent: false, employerSize: 'under100' })
    expect(lines.every((l) => l.status === 'clear')).toBe(true)
  })

  it('marks a line exactly at its threshold as near, not over', () => {
    const lines = calculateKabeLines({ annualIncome: 130, isStudent: false, employerSize: 'under100' })
    const line = lines.find((l) => l.key === 'social-insurance-130')
    expect(line?.status).toBe('near')
  })
})

describe('summarize', () => {
  it('reports no issues when nothing is close or over', () => {
    const lines = calculateKabeLines({ annualIncome: 50, isStudent: false, employerSize: 'under100' })
    expect(summarize(lines)).toContain('余裕があります')
  })

  it('reports over-count when at least one line is exceeded', () => {
    const lines = calculateKabeLines({ annualIncome: 200, isStudent: false, employerSize: 'over100' })
    expect(summarize(lines)).toContain('超えています')
  })
})
