import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  buildReorderUpdates,
  dateStripDays,
  formatMinutes,
  monthDays,
  nextSortOrder,
  plansForDate,
  todayPlansFor,
  todaySubjectBreakdown,
} from './learningTabLogic.js'

const records = [
  { id: 'p3', studentId: 's1', date: '2026-06-05', recordType: 'planner', subject: '과학', sortOrder: 3, plannedMin: 30 },
  { id: 'p1', studentId: 's1', date: '2026-06-05', recordType: 'planner', subject: '수학', sortOrder: 1, plannedMin: 60 },
  { id: 'p2', studentId: 's1', date: '2026-06-05', recordType: 'planner', subject: '영어', sortOrder: 2, plannedMin: 45 },
  { id: 'p4', studentId: 's1', date: '2026-06-06', recordType: 'planner', subject: '국어', sortOrder: 1, plannedMin: 20 },
  { id: 't1', studentId: 's1', date: '2026-06-05', recordType: 'timer', subject: '수학', actualDuration: 50 },
  { id: 't2', studentId: 's1', date: '2026-06-05', recordType: 'timer', subject: '영어', duration: 40 },
  { id: 't3', studentId: 's1', date: '2026-06-04', recordType: 'timer', subject: '과학', actualDuration: 90 },
  { id: 'other', studentId: 's2', date: '2026-06-05', recordType: 'planner', subject: '수학', sortOrder: 1 },
]

describe('learning tab date helpers', () => {
  it('선택 날짜가 가운데인 7일 스트립을 만든다', () => {
    expect(dateStripDays('2026-06-05')).toEqual([
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
      '2026-06-08',
    ])
  })

  it('월 이동은 해당 월 1일로 이동한다', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-01')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
  })

  it('월 캘린더는 6주 42일을 반환한다', () => {
    const days = monthDays('2026-06-05')
    expect(days).toHaveLength(42)
    expect(days[0]).toBe('2026-05-31')
    expect(days[41]).toBe('2026-07-11')
  })

  it('날짜 덧셈은 월 경계를 넘는다', () => {
    expect(addDays('2026-06-01', -1)).toBe('2026-05-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('learning tab plan ordering', () => {
  it('날짜/학생/계획만 골라 sortOrder 순서로 정렬한다', () => {
    expect(plansForDate(records, 's1', '2026-06-05').map((r) => r.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('오늘 계획 helper도 같은 정렬을 쓴다', () => {
    expect(todayPlansFor(records, 's1', '2026-06-05').map((r) => r.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('sortOrder 없는 항목은 뒤로 보내고 id로 안정 정렬한다', () => {
    const unordered = [
      { id: 'b', studentId: 's1', date: '2026-06-05', recordType: 'planner' },
      { id: 'a', studentId: 's1', date: '2026-06-05', recordType: 'planner' },
      { id: 'c', studentId: 's1', date: '2026-06-05', recordType: 'planner', sortOrder: 1 },
    ]
    expect(plansForDate(unordered, 's1', '2026-06-05').map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })

  it('드래그 reorder 업데이트를 1부터 다시 만든다', () => {
    const plans = plansForDate(records, 's1', '2026-06-05')
    expect(buildReorderUpdates(plans, 'p3', 'p1')).toEqual([
      { id: 'p3', sortOrder: 1 },
      { id: 'p1', sortOrder: 2 },
      { id: 'p2', sortOrder: 3 },
    ])
  })

  it('잘못된 드래그는 업데이트하지 않는다', () => {
    const plans = plansForDate(records, 's1', '2026-06-05')
    expect(buildReorderUpdates(plans, 'p1', 'p1')).toEqual([])
    expect(buildReorderUpdates(plans, 'missing', 'p1')).toEqual([])
  })

  it('새 계획은 현재 날짜 계획의 마지막 순서 다음으로 들어간다', () => {
    expect(nextSortOrder(plansForDate(records, 's1', '2026-06-05'))).toBe(4)
  })
})

describe('learning tab display metrics', () => {
  it('분 표시를 n시간 n분 형식으로 만든다', () => {
    expect(formatMinutes(0)).toBe('0분')
    expect(formatMinutes(45)).toBe('45분')
    expect(formatMinutes(60)).toBe('1시간')
    expect(formatMinutes(75)).toBe('1시간 15분')
  })

  it('공부하기 막대는 오늘 실제 학습시간만 과목별로 집계한다', () => {
    expect(todaySubjectBreakdown(records, '2026-06-05')).toEqual([
      { name: '수학', minutes: 50 },
      { name: '영어', minutes: 40 },
    ])
  })
})
