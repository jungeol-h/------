import { describe, it, expect } from 'vitest'
import { getAttendanceTotals, getAvgLearningMinutes, getCounselingTypeCounts } from './adminStats.js'

describe('getAttendanceTotals', () => {
  it('상태별 합계 + 조퇴는 독립 집계', () => {
    const data = {
      attendanceRecords: [
        { status: 'present' },
        { status: 'present', checkoutStatus: 'early_leave' },
        { status: 'late' },
        { status: 'absent' },
      ],
    }
    expect(getAttendanceTotals(data)).toEqual({ present: 2, late: 1, absent: 1, earlyLeave: 1 })
  })

  it('빈 데이터면 전부 0', () => {
    expect(getAttendanceTotals({})).toEqual({ present: 0, late: 0, absent: 0, earlyLeave: 0 })
  })
})

describe('getAvgLearningMinutes', () => {
  const today = new Date('2026-07-11T12:00:00')

  it('active 학생 전체 인원으로 나눈 평균', () => {
    const data = {
      students: [
        { id: 's1', status: 'active' },
        { id: 's2', status: 'active' },
        { id: 's3', status: 'inactive' },
      ],
      learningRecords: [
        { studentId: 's1', date: '2026-07-10', duration: 60 },
        { studentId: 's1', date: '2026-07-09', duration: 40 },
        { studentId: 's3', date: '2026-07-10', duration: 999 }, // 비활성 제외
        { studentId: 's1', date: '2026-01-01', duration: 999 }, // 기간 밖
      ],
    }
    expect(getAvgLearningMinutes(data, { days: 30, today })).toBe(50)
  })

  it('학생 없으면 0', () => {
    expect(getAvgLearningMinutes({}, { today })).toBe(0)
  })
})

describe('getCounselingTypeCounts', () => {
  it('유형별 카운트 많은 순, 구 체계 값도 라벨 표시', () => {
    const data = {
      counselingRecords: [
        { type: 'career_path' },
        { type: 'career_path' },
        { type: 'study' }, // 구 체계
        { type: null },    // → etc
      ],
    }
    const result = getCounselingTypeCounts(data)
    expect(result[0]).toEqual({ type: 'career_path', label: '진로진학', count: 2 })
    expect(result.find((r) => r.type === 'study').label).toBe('학습')
    expect(result.find((r) => r.type === 'etc').count).toBe(1)
  })
})
