import { describe, it, expect } from 'vitest'
import { getStudentIndicatorMap } from './studentIndicators.js'

const today = new Date('2026-07-11T12:00:00')

describe('getStudentIndicatorMap', () => {
  it('빈 데이터면 빈 Map', () => {
    expect(getStudentIndicatorMap({}, today).size).toBe(0)
  })

  it('최근 30일 결석만 센다', () => {
    const data = {
      attendanceRecords: [
        { studentId: 's1', date: '2026-07-10', status: 'absent' },
        { studentId: 's1', date: '2026-07-09', status: 'present' },
        { studentId: 's1', date: '2026-05-01', status: 'absent' }, // 30일 밖
        { studentId: 's2', date: '2026-07-10', status: 'absent' },
      ],
    }
    const map = getStudentIndicatorMap(data, today)
    expect(map.get('s1').absentCount).toBe(1)
    expect(map.get('s2').absentCount).toBe(1)
  })

  it('최근 7일 이행률 — 계획 없으면 null', () => {
    const data = {
      learningRecords: [
        { studentId: 's1', date: '2026-07-10', recordType: 'planner', plannedMin: 100, status: 'pending' },
        { studentId: 's1', date: '2026-07-10', recordType: 'timer', actualDuration: 60 },
        { studentId: 's2', date: '2026-07-10', recordType: 'timer', actualDuration: 30 },
        { studentId: 's1', date: '2026-06-01', recordType: 'planner', plannedMin: 999 }, // 7일 밖
      ],
    }
    const map = getStudentIndicatorMap(data, today)
    expect(map.get('s1').fulfillment.rate).toBeCloseTo(0.6)
    expect(map.get('s2').fulfillment).toBeNull()
  })

  it('마인드 — 최근 기록 기준 양호/주의/위험', () => {
    const data = {
      mindRecords: [
        { studentId: 's1', date: '2026-07-01', mood: -5, motivation: -5, confidence: -5 },
        { studentId: 's1', date: '2026-07-10', mood: 2, motivation: 2, confidence: 2 }, // 최근이 우선
        { studentId: 's2', date: '2026-07-10', mood: -3, motivation: 0, confidence: 0 },
        { studentId: 's3', date: '2026-07-10', mood: -5, motivation: -3, confidence: -2 },
      ],
    }
    const map = getStudentIndicatorMap(data, today)
    expect(map.get('s1').mind).toBe('good')
    expect(map.get('s2').mind).toBe('caution')
    expect(map.get('s3').mind).toBe('risk')
  })

  it('과제 완료/전체와 일정 태그 횟수', () => {
    const data = {
      tasks: [
        { studentId: 's1', status: 'done' },
        { studentId: 's1', status: 'pending' },
      ],
      workPlans: [
        { studentIds: ['s1', 's2'] },
        { studentIds: ['s1'] },
      ],
    }
    const map = getStudentIndicatorMap(data, today)
    expect(map.get('s1').tasksDone).toBe(1)
    expect(map.get('s1').tasksTotal).toBe(2)
    expect(map.get('s1').planCount).toBe(2)
    expect(map.get('s2').planCount).toBe(1)
  })
})
