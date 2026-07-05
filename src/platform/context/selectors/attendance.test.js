import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  getWeeklySchedule,
  classifyToday,
  getTodayAttendanceBoard,
  getUnresolvedAttendanceNotifications,
} from './attendance.js'

// 2026-07-06 은 월요일 (dow=1)
const MONDAY_15H = new Date('2026-07-06T15:00:00')

describe('timeToMinutes', () => {
  it('HH:MM을 분으로 변환한다', () => {
    expect(timeToMinutes('15:30')).toBe(930)
    expect(timeToMinutes('00:00')).toBe(0)
  })
  it('파싱 불가 입력은 null', () => {
    expect(timeToMinutes(null)).toBeNull()
    expect(timeToMinutes('')).toBeNull()
    expect(timeToMinutes('abc')).toBeNull()
  })
})

describe('getWeeklySchedule — 7칸 배열 정리', () => {
  it('요일 자리에 시간표를 놓고 없는 요일은 null', () => {
    const data = {
      attendanceSchedules: [
        { studentId: 's1', dayOfWeek: 1, arrivalTime: '15:00', departureTime: '19:00' },
        { studentId: 's1', dayOfWeek: 3, arrivalTime: '16:00', departureTime: '20:00' },
        { studentId: 's2', dayOfWeek: 1, arrivalTime: '10:00', departureTime: '12:00' },
      ],
    }
    const week = getWeeklySchedule(data, 's1')
    expect(week).toHaveLength(7)
    expect(week[1].arrivalTime).toBe('15:00')
    expect(week[3].arrivalTime).toBe('16:00')
    expect(week[0]).toBeNull()
    expect(week[2]).toBeNull()
  })
})

describe('classifyToday — 오늘 상태 분류', () => {
  const schedule = { arrivalTime: '15:00', departureTime: '19:00' }

  it('하원 완료(정상)는 checked_out', () => {
    const record = { checkInAt: 'x', checkOutAt: 'y', status: 'present', checkoutStatus: 'normal' }
    expect(classifyToday({ record, schedule, now: MONDAY_15H })).toBe('checked_out')
  })
  it('예정보다 이른 하원은 early_leave(조퇴)', () => {
    const record = { checkInAt: 'x', checkOutAt: 'y', status: 'present', checkoutStatus: 'early_leave' }
    expect(classifyToday({ record, schedule, now: MONDAY_15H })).toBe('early_leave')
  })
  it('등원 중 — 서버 판정 status를 그대로 따른다', () => {
    expect(classifyToday({
      record: { checkInAt: 'x', checkOutAt: null, status: 'present' },
      schedule, now: MONDAY_15H,
    })).toBe('present')
    expect(classifyToday({
      record: { checkInAt: 'x', checkOutAt: null, status: 'late' },
      schedule, now: MONDAY_15H,
    })).toBe('late')
  })
  it('cron 자동 결석(check_in 없이 absent)은 absent', () => {
    const record = { checkInAt: null, checkOutAt: null, status: 'absent' }
    expect(classifyToday({ record, schedule, now: MONDAY_15H })).toBe('absent')
  })
  it('기록 없음 + 예정 시간 전이면 waiting, 지나면 not_arrived', () => {
    const at1459 = new Date('2026-07-06T14:59:00')
    const at1500 = new Date('2026-07-06T15:00:00')
    const at1501 = new Date('2026-07-06T15:01:00')
    expect(classifyToday({ record: null, schedule, now: at1459 })).toBe('waiting')
    // 정각까지는 아직 미등원 아님 (서버 지각 판정도 정각 초과부터)
    expect(classifyToday({ record: null, schedule, now: at1500 })).toBe('waiting')
    expect(classifyToday({ record: null, schedule, now: at1501 })).toBe('not_arrived')
  })
  it('기록도 시간표도 없으면 no_schedule', () => {
    expect(classifyToday({ record: null, schedule: null, now: MONDAY_15H })).toBe('no_schedule')
  })
})

describe('getTodayAttendanceBoard — 담당 학생 현황판', () => {
  const data = {
    students: [
      { id: 's1', name: '가' },
      { id: 's2', name: '나' },
      { id: 's3', name: '다' },
      { id: 's9', name: '남의학생' },
    ],
    assignments: [
      { educatorId: 'm01', studentId: 's1' },
      { educatorId: 'm01', studentId: 's2' },
      { educatorId: 'm01', studentId: 's3' },
      { educatorId: 'm02', studentId: 's9' },
    ],
    attendanceRecords: [
      { studentId: 's1', date: '2026-07-06', status: 'late', checkInAt: 'x', checkOutAt: null },
      // 어제 기록은 무시되어야 한다
      { studentId: 's2', date: '2026-07-05', status: 'present', checkInAt: 'x', checkOutAt: null },
    ],
    attendanceSchedules: [
      { studentId: 's1', dayOfWeek: 1, arrivalTime: '14:00', departureTime: '19:00' },
      { studentId: 's2', dayOfWeek: 1, arrivalTime: '14:00', departureTime: '19:00' },
      // s3는 월요일 시간표 없음
      { studentId: 's3', dayOfWeek: 2, arrivalTime: '14:00', departureTime: '19:00' },
    ],
  }

  it('오늘 기록·오늘 요일 시간표만으로 분류하고 담당 외 학생은 제외한다', () => {
    const board = getTodayAttendanceBoard(data, { educatorId: 'm01', now: MONDAY_15H })
    expect(board.late.map((e) => e.student.id)).toEqual(['s1'])
    expect(board.not_arrived.map((e) => e.student.id)).toEqual(['s2'])
    expect(board.no_schedule.map((e) => e.student.id)).toEqual(['s3'])
    const allIds = Object.values(board).flat().map((e) => e.student.id)
    expect(allIds).not.toContain('s9')
  })
})

describe('getUnresolvedAttendanceNotifications', () => {
  it('담당 학생의 미해결 알림만 최신순으로, 이름을 붙여 반환한다', () => {
    const data = {
      students: [{ id: 's1', name: '가' }, { id: 's9', name: '남' }],
      assignments: [
        { educatorId: 'm01', studentId: 's1' },
        { educatorId: 'm02', studentId: 's9' },
      ],
      attendanceNotifications: [
        { id: 'n1', studentId: 's1', resolved: false, createdAt: '2026-07-06T06:10:00Z' },
        { id: 'n2', studentId: 's1', resolved: true, createdAt: '2026-07-06T06:30:00Z' },
        { id: 'n3', studentId: 's1', resolved: false, createdAt: '2026-07-06T06:40:00Z' },
        { id: 'n4', studentId: 's9', resolved: false, createdAt: '2026-07-06T06:50:00Z' },
      ],
    }
    const result = getUnresolvedAttendanceNotifications(data, { educatorId: 'm01' })
    expect(result.map((n) => n.id)).toEqual(['n3', 'n1'])
    expect(result[0].studentName).toBe('가')
  })
})
