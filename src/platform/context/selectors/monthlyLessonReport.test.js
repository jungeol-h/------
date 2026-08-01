import { describe, it, expect } from 'vitest'
import { buildMonthlyLessonEntries } from './monthlyLessonReport.js'

describe('buildMonthlyLessonEntries', () => {
  const getStudent = (id) =>
    ({
      s1: { name: '김학생' },
      s2: { name: '이학생' },
    })[id]

  const base = {
    startTime: '', endTime: '',
    topic: '수학', textbook: '쎈', content: '내용', homework: '과제', note: '',
  }
  const opts = { educatorId: 'e1', startDate: '2026-07-01', endDate: '2026-07-31' }

  it('기간 경계(1일·말일) 포함, 기간 밖 제외하고 no를 재부여한다', () => {
    const reports = [
      { id: 'r1', authorId: 'e1', date: '2026-06-30', studentIds: ['s1'], ...base },
      { id: 'r2', authorId: 'e1', date: '2026-07-01', studentIds: ['s1'], ...base },
      { id: 'r3', authorId: 'e1', date: '2026-07-31', studentIds: ['s2'], ...base },
      { id: 'r4', authorId: 'e1', date: '2026-08-01', studentIds: ['s2'], ...base },
    ]
    const { entries, totalCount } = buildMonthlyLessonEntries(reports, getStudent, opts)
    expect(totalCount).toBe(2)
    expect(entries.map((e) => e.no)).toEqual([1, 2])
    expect(entries.map((e) => e.cumulativeText)).toEqual(['2회차', '3회차'])
  })

  it('누적회차는 기간 이전 이력을 포함해 강사 기준으로 센다 (타 강사 기록 제외)', () => {
    const reports = [
      { id: 'r1', authorId: 'e1', date: '2026-05-10', studentIds: ['s1'], ...base },
      { id: 'r2', authorId: 'e1', date: '2026-06-14', studentIds: ['s1'], ...base },
      { id: 'r3', authorId: 'e1', date: '2026-07-04', studentIds: ['s1'], ...base },
      // 타 강사 기록 — 누적에서 제외
      { id: 'r4', authorId: 'e2', date: '2026-06-01', studentIds: ['s1'], ...base },
    ]
    const { entries, totalCount } = buildMonthlyLessonEntries(reports, getStudent, opts)
    expect(totalCount).toBe(1)
    expect(entries[0].cumulativeText).toBe('3회차')
    expect(entries[0].no).toBe(1)
  })

  it('studentNames는 이름 조인, 미등록 id는 "-", studentCountText는 인원수', () => {
    const reports = [
      { id: 'r1', authorId: 'e1', date: '2026-07-04', studentIds: ['s1', 'ghost', 's2'], ...base },
    ]
    const { entries } = buildMonthlyLessonEntries(reports, getStudent, opts)
    expect(entries[0].studentNames).toBe('김학생, -, 이학생')
    expect(entries[0].studentCountText).toBe('3명')
  })

  it('시간 없는 기록은 dateTimeText가 날짜만', () => {
    const reports = [
      { id: 'r1', authorId: 'e1', date: '2026-07-04', studentIds: ['s1'], ...base },
      {
        id: 'r2', authorId: 'e1', date: '2026-07-11', studentIds: ['s1'],
        ...base, startTime: '14:00', endTime: '14:50',
      },
    ]
    const { entries } = buildMonthlyLessonEntries(reports, getStudent, opts)
    expect(entries[0].dateTimeText).toBe('7. 4.(토)')
    expect(entries[1].dateTimeText).toBe('7. 11.(토) 14:00~14:50 (50분)')
  })

  it('빈 reports 방어', () => {
    expect(buildMonthlyLessonEntries([], getStudent, opts)).toEqual({ entries: [], totalCount: 0 })
  })
})
