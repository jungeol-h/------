import { describe, it, expect } from 'vitest'
import { getAttendanceSummary, getAttendanceCautionStudents } from './attendanceStats.js'

describe('getAttendanceSummary — 출결 누적 통계', () => {
  it('빈 데이터면 0 카운트와 빈 배열', () => {
    const result = getAttendanceSummary({ attendanceRecords: [] }, 's1')
    expect(result.counts).toEqual({ present: 0, late: 0, earlyLeave: 0, absent: 0 })
    expect(result.records).toEqual([])
  })

  it('data 자체가 없어도 안전하게 빈 결과를 낸다', () => {
    const result = getAttendanceSummary(undefined, 's1')
    expect(result.counts).toEqual({ present: 0, late: 0, earlyLeave: 0, absent: 0 })
    expect(result.records).toEqual([])
  })

  it('status별 출석·지각·결석을 센다', () => {
    const data = {
      attendanceRecords: [
        { id: 'a', studentId: 's1', date: '2026-07-01', status: 'present' },
        { id: 'b', studentId: 's1', date: '2026-07-02', status: 'late' },
        { id: 'c', studentId: 's1', date: '2026-07-03', status: 'absent' },
        { id: 'd', studentId: 's1', date: '2026-07-04', status: 'present' },
        // 다른 학생 기록은 제외
        { id: 'x', studentId: 's2', date: '2026-07-05', status: 'late' },
      ],
    }
    const { counts } = getAttendanceSummary(data, 's1')
    expect(counts).toEqual({ present: 2, late: 1, earlyLeave: 0, absent: 1 })
  })

  it('조퇴는 status와 독립적으로 checkoutStatus 기준으로 센다', () => {
    const data = {
      attendanceRecords: [
        // 지각이면서 조퇴 → late·earlyLeave 양쪽 카운트
        { id: 'a', studentId: 's1', date: '2026-07-01', status: 'late', checkoutStatus: 'early_leave' },
        // 정상 출석이지만 조퇴
        { id: 'b', studentId: 's1', date: '2026-07-02', status: 'present', checkoutStatus: 'early_leave' },
        // 정상 하원
        { id: 'c', studentId: 's1', date: '2026-07-03', status: 'present', checkoutStatus: 'normal' },
      ],
    }
    const { counts } = getAttendanceSummary(data, 's1')
    expect(counts.late).toBe(1)
    expect(counts.present).toBe(2)
    expect(counts.earlyLeave).toBe(2)
  })

  it('records를 날짜 내림차순으로 정렬하고 필요한 필드만 담는다', () => {
    const data = {
      attendanceRecords: [
        { id: 'a', studentId: 's1', date: '2026-07-01', status: 'present', checkInAt: '2026-07-01T15:00:00Z', checkOutAt: '2026-07-01T19:00:00Z', checkoutStatus: 'normal' },
        { id: 'b', studentId: 's1', date: '2026-07-03', status: 'late', checkInAt: '2026-07-03T15:10:00Z', checkOutAt: null, checkoutStatus: null },
        { id: 'c', studentId: 's1', date: '2026-07-02', status: 'absent' },
      ],
    }
    const { records } = getAttendanceSummary(data, 's1')
    expect(records.map((r) => r.date)).toEqual(['2026-07-03', '2026-07-02', '2026-07-01'])
    expect(records[0]).toEqual({
      id: 'b',
      date: '2026-07-03',
      status: 'late',
      checkoutStatus: null,
      checkInAt: '2026-07-03T15:10:00Z',
      checkOutAt: null,
    })
    // 누락 필드는 null로 정규화
    expect(records[1].checkInAt).toBeNull()
    expect(records[1].checkOutAt).toBeNull()
  })
})

describe('getAttendanceCautionStudents — 출결 주의 (최근 30일 결석 3회 이상)', () => {
  const today = new Date('2026-07-10T00:00:00')
  const students = [
    { id: 's1', name: '가' },
    { id: 's2', name: '나' },
    { id: 's3', name: '다', status: 'inactive' },
  ]
  const absent = (studentId, date) => ({ studentId, date, status: 'absent' })

  it('최근 30일 결석 3회 이상인 active 학생만 결석 많은 순으로 반환', () => {
    const data = {
      students,
      attendanceRecords: [
        absent('s1', '2026-07-01'), absent('s1', '2026-07-03'), absent('s1', '2026-07-05'),
        absent('s2', '2026-07-01'), absent('s2', '2026-07-02'), absent('s2', '2026-07-03'), absent('s2', '2026-07-04'),
        absent('s3', '2026-07-01'), absent('s3', '2026-07-02'), absent('s3', '2026-07-03'),
      ],
    }
    const result = getAttendanceCautionStudents(data, { today })
    expect(result.map((x) => x.student.id)).toEqual(['s2', 's1'])
    expect(result[0].absentCount).toBe(4)
  })

  it('30일보다 오래된 결석과 결석 아닌 기록은 세지 않는다', () => {
    const data = {
      students,
      attendanceRecords: [
        absent('s1', '2026-05-01'), absent('s1', '2026-05-02'), absent('s1', '2026-05-03'),
        { studentId: 's1', date: '2026-07-01', status: 'late' },
        absent('s1', '2026-07-02'), absent('s1', '2026-07-03'),
      ],
    }
    expect(getAttendanceCautionStudents(data, { today })).toEqual([])
  })

  it('빈 데이터도 안전', () => {
    expect(getAttendanceCautionStudents({}, { today })).toEqual([])
  })
})
