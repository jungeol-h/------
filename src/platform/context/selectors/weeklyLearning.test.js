import { describe, it, expect } from 'vitest'
import { lastSevenDays, getWeeklyLearning } from './weeklyLearning.js'

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
