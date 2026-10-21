import { describe, expect, it } from 'vitest'
import { EXAM_TYPES, examKeyLabel, sameExamKey, defaultExamKey, examKeyOptions } from './examTerms.js'

describe('examTerms', () => {
  it('라벨', () => {
    expect(EXAM_TYPES).toHaveLength(2)
    expect(examKeyLabel({ examYear: 2026, semester: 2, examType: 'final' })).toBe('2026학년도 2학기 기말')
    expect(examKeyLabel({ examYear: 2026, semester: 1, examType: 'mid' })).toBe('2026학년도 1학기 중간')
  })

  it('sameExamKey', () => {
    const a = { examYear: 2026, semester: 1, examType: 'mid' }
    expect(sameExamKey(a, { ...a })).toBe(true)
    expect(sameExamKey(a, { ...a, examType: 'final' })).toBe(false)
    expect(sameExamKey(a, null)).toBe(false)
  })

  it('defaultExamKey — 월별 매핑', () => {
    expect(defaultExamKey('2026-01-15')).toEqual({ examYear: 2025, semester: 2, examType: 'final' })
    expect(defaultExamKey('2026-02-28')).toEqual({ examYear: 2025, semester: 2, examType: 'final' })
    expect(defaultExamKey('2026-03-01')).toEqual({ examYear: 2026, semester: 1, examType: 'mid' })
    expect(defaultExamKey('2026-05-31')).toEqual({ examYear: 2026, semester: 1, examType: 'mid' })
    expect(defaultExamKey('2026-06-10')).toEqual({ examYear: 2026, semester: 1, examType: 'final' })
    expect(defaultExamKey('2026-07-31')).toEqual({ examYear: 2026, semester: 1, examType: 'final' })
    expect(defaultExamKey('2026-08-01')).toEqual({ examYear: 2026, semester: 2, examType: 'mid' })
    expect(defaultExamKey('2026-10-21')).toEqual({ examYear: 2026, semester: 2, examType: 'mid' })
    expect(defaultExamKey('2026-11-01')).toEqual({ examYear: 2026, semester: 2, examType: 'final' })
    expect(defaultExamKey('2026-12-31')).toEqual({ examYear: 2026, semester: 2, examType: 'final' })
  })

  it('examKeyOptions — 최신순, 학년도 경계', () => {
    const opts = examKeyOptions('2026-10-21', 6)
    expect(opts).toHaveLength(6)
    expect(opts[0]).toEqual({ examYear: 2026, semester: 2, examType: 'mid' })
    expect(opts[1]).toEqual({ examYear: 2026, semester: 1, examType: 'final' })
    expect(opts[3]).toEqual({ examYear: 2025, semester: 2, examType: 'final' })
    expect(opts[5]).toEqual({ examYear: 2025, semester: 1, examType: 'final' })
  })
})
