import { describe, it, expect } from 'vitest'
import { lastSevenDays, getWeeklyLearning, getLearningCautionStudents } from './weeklyLearning.js'

describe('lastSevenDays', () => {
  it('7일을 과거→오늘 순으로 반환', () => {
    const days = lastSevenDays(new Date('2026-05-16T00:00:00'))
    expect(days).toEqual([
      '2026-05-10', '2026-05-11', '2026-05-12', '2026-05-13',
      '2026-05-14', '2026-05-15', '2026-05-16',
    ])
  })
})

describe('getWeeklyLearning', () => {
  const today = new Date('2026-05-16T00:00:00')

  it('학습기록 없으면 모든 날 0분', () => {
    const result = getWeeklyLearning({ learningRecords: [] }, 's1', today)
    expect(result).toHaveLength(7)
    expect(result.every((d) => d.minutes === 0)).toBe(true)
  })

  it('같은 날 여러 기록은 합산', () => {
    const data = {
      learningRecords: [
        { studentId: 's1', date: '2026-05-16', duration: 30 },
        { studentId: 's1', date: '2026-05-16', duration: 45 },
      ],
    }
    const result = getWeeklyLearning(data, 's1', today)
    expect(result.find((d) => d.day === '05-16').minutes).toBe(75)
  })

  it('계획-only 기록은 학습시간에 합산하지 않는다', () => {
    const data = {
      learningRecords: [
        { studentId: 's1', date: '2026-05-16', recordType: 'planner', plannedMin: 60 },
        { studentId: 's1', date: '2026-05-16', recordType: 'timer', actualDuration: 45 },
      ],
    }
    const result = getWeeklyLearning(data, 's1', today)
    expect(result.find((d) => d.day === '05-16').minutes).toBe(45)
  })

  it('7일 범위 밖 기록은 제외', () => {
    const data = {
      learningRecords: [
        { studentId: 's1', date: '2026-05-01', duration: 999 },
      ],
    }
    const result = getWeeklyLearning(data, 's1', today)
    expect(result.every((d) => d.minutes === 0)).toBe(true)
  })

  it('다른 학생 기록은 제외', () => {
    const data = {
      learningRecords: [
        { studentId: 's2', date: '2026-05-16', duration: 100 },
      ],
    }
    const result = getWeeklyLearning(data, 's1', today)
    expect(result.find((d) => d.day === '05-16').minutes).toBe(0)
  })
})

describe('getLearningCautionStudents — 학습 주의 (최근 7일 이행률 60% 미만)', () => {
  const today = new Date('2026-07-10T00:00:00')
  const students = [
    { id: 's1', name: '가' },
    { id: 's2', name: '나' },
    { id: 's3', name: '다' },
  ]

  it('계획 대비 실행 60% 미만인 학생만 이행률 낮은 순으로 반환', () => {
    const data = {
      students,
      learningRecords: [
        // s1: 계획 100, 실행 50 → 50% (주의)
        { studentId: 's1', date: '2026-07-09', plannedMin: 100, actualDuration: 50 },
        // s2: 계획 100, 실행 80 → 80% (정상)
        { studentId: 's2', date: '2026-07-09', plannedMin: 100, actualDuration: 80 },
        // s3: 계획 200, 실행 20 → 10% (주의, s1보다 낮음)
        { studentId: 's3', date: '2026-07-08', plannedMin: 200, actualDuration: 20 },
      ],
    }
    const result = getLearningCautionStudents(data, today)
    expect(result.map((x) => x.student.id)).toEqual(['s3', 's1'])
    expect(result[1]).toMatchObject({ plannedMin: 100, actualMin: 50, rate: 0.5 })
  })

  it('계획이 없는 학생은 판정 제외, 7일 밖 기록은 무시', () => {
    const data = {
      students,
      learningRecords: [
        { studentId: 's1', date: '2026-07-09', plannedMin: null, actualDuration: 0 },
        { studentId: 's2', date: '2026-06-01', plannedMin: 100, actualDuration: 0 },
      ],
    }
    expect(getLearningCautionStudents(data, today)).toEqual([])
    expect(getLearningCautionStudents({}, today)).toEqual([])
  })
})
