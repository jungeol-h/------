import { describe, it, expect } from 'vitest'
import { getDailyReport, getWeeklyReport } from './report.js'

const data = {
  students: [{ id: 's1' }],
  learningRecords: [
    { studentId: 's1', date: '2026-05-16', subject: '수학', duration: 60, focus: 80 },
    { studentId: 's1', date: '2026-05-16', subject: '영어', duration: 40, focus: 60 },
    { studentId: 's1', date: '2026-05-12', subject: '수학', duration: 30, focus: 50 },
  ],
  tasks: [
    { studentId: 's1', status: 'done' },
    { studentId: 's1', status: 'pending' },
    { studentId: 's1', status: 'done' },
  ],
  mindRecords: [
    { studentId: 's1', date: '2026-05-16', mood: 2, motivation: 1, confidence: 0 },
    { studentId: 's1', date: '2026-05-14', mood: -1, motivation: -2, confidence: 0 },
  ],
  diaryRecords: [
    { studentId: 's1', date: '2026-05-16', praise: '집중함' },
  ],
}

describe('getDailyReport', () => {
  it('해당 날짜 학습시간 합산', () => {
    const r = getDailyReport(data, 's1', '2026-05-16')
    expect(r.totalMinutes).toBe(100)
  })
  it('과제 완료/전체 집계', () => {
    const r = getDailyReport(data, 's1', '2026-05-16')
    expect(r.taskDone).toBe(2)
    expect(r.taskTotal).toBe(3)
  })
  it('마인드 합산 점수', () => {
    const r = getDailyReport(data, 's1', '2026-05-16')
    expect(r.mindTotal).toBe(3)
  })
  it('마인드 기록 없는 날은 mindTotal null', () => {
    const r = getDailyReport(data, 's1', '2026-05-15')
    expect(r.mindTotal).toBeNull()
  })
  it('일기를 포함', () => {
    const r = getDailyReport(data, 's1', '2026-05-16')
    expect(r.diary.praise).toBe('집중함')
  })
})

describe('getWeeklyReport', () => {
  const today = new Date('2026-05-16T00:00:00')

  it('최근 7일 학습시간만 합산 (범위 밖 제외)', () => {
    // 05-16의 100분 + 05-12의 30분, 둘 다 7일 내
    const r = getWeeklyReport(data, 's1', today)
    expect(r.totalMinutes).toBe(130)
  })
  it('과제 완료율(%)', () => {
    const r = getWeeklyReport(data, 's1', today)
    expect(r.taskRate).toBe(67) // 2/3
  })
  it('평균 집중도', () => {
    const r = getWeeklyReport(data, 's1', today)
    // (80 + 60 + 50) / 3 = 63.3 → 63
    expect(r.avgFocus).toBe(63)
  })
  it('마인드 추이는 날짜 오름차순', () => {
    const r = getWeeklyReport(data, 's1', today)
    expect(r.mindTrend.map((m) => m.date)).toEqual([
      '2026-05-14', '2026-05-16',
    ])
  })
  it('일별 학습시간 배열 7개', () => {
    const r = getWeeklyReport(data, 's1', today)
    expect(r.dailyMinutes).toHaveLength(7)
  })
})
