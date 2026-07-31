import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  getWeeklySchedule,
  classifyToday,
  classifyForDate,
  getTodayAttendanceBoard,
  getDailyAttendanceBoard,
  getUnresolvedAttendanceNotifications,
  isReentry,
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
  it('재등원(하원 후 다시 등원) — check_out_at이 리셋되어 등원 중으로 분류된다', () => {
    // kiosk_check_in의 재등원 처리는 check_out_at을 NULL로 리셋하므로
    // 분류 결과는 최초 등원과 동일하게 present/late로 나와야 한다.
    expect(classifyToday({
      record: { checkInAt: 'x', checkOutAt: null, status: 'present', events: [{ type: 'in' }, { type: 'out' }, { type: 'in' }] },
      schedule, now: MONDAY_15H,
    })).toBe('present')
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

  it('all=true(관리자)면 배정과 무관하게 전체 active 학생을 포함한다', () => {
    const withInactive = {
      ...data,
      students: [...data.students, { id: 's10', name: '탈퇴생', status: 'inactive' }],
    }
    const board = getTodayAttendanceBoard(withInactive, { all: true, now: MONDAY_15H })
    const allIds = Object.values(board).flat().map((e) => e.student.id)
    expect(allIds).toContain('s9')
    expect(allIds).not.toContain('s10')
  })
})

describe('classifyForDate — 지난·미래 날짜 분류', () => {
  const schedule = { arrivalTime: '15:00', departureTime: '19:00' }

  it('지난 날짜: 기록 없는 예정자는 시각 무관 not_arrived', () => {
    expect(classifyForDate({ record: null, schedule, dateStr: '2026-07-03', now: MONDAY_15H }))
      .toBe('not_arrived')
  })
  it('지난 날짜: cron 결석 기록은 absent, 등원 기록은 그대로 따른다', () => {
    expect(classifyForDate({
      record: { checkInAt: null, checkOutAt: null, status: 'absent' },
      schedule, dateStr: '2026-07-03', now: MONDAY_15H,
    })).toBe('absent')
    expect(classifyForDate({
      record: { checkInAt: 'x', checkOutAt: 'y', status: 'late', checkoutStatus: 'normal' },
      schedule, dateStr: '2026-07-03', now: MONDAY_15H,
    })).toBe('checked_out')
  })
  it('지난 날짜: 예정 없는 학생은 no_schedule', () => {
    expect(classifyForDate({ record: null, schedule: null, dateStr: '2026-07-03', now: MONDAY_15H }))
      .toBe('no_schedule')
  })
  it('미래 날짜: 기록 없는 예정자는 waiting', () => {
    expect(classifyForDate({ record: null, schedule, dateStr: '2026-07-08', now: MONDAY_15H }))
      .toBe('waiting')
  })
})

describe('getDailyAttendanceBoard — 날짜별 현황판 (등록명단 기준)', () => {
  // 2026-07-03 은 금요일 (dow=5)
  const data = {
    students: [
      { id: 's1', name: '가' },
      { id: 's2', name: '나' },
      { id: 's3', name: '다' },
    ],
    assignments: [
      { educatorId: 'm01', studentId: 's1' },
      { educatorId: 'm01', studentId: 's2' },
      { educatorId: 'm01', studentId: 's3' },
    ],
    attendanceRecords: [
      { studentId: 's1', date: '2026-07-03', status: 'absent', checkInAt: null, checkOutAt: null },
    ],
    attendanceSchedules: [
      { studentId: 's3', dayOfWeek: 5, arrivalTime: '10:00', departureTime: '12:00' },
    ],
  }
  const registrations = [
    // s2 는 금요일 두 블록 — pseudo-schedule 은 첫 시작~마지막 종료로 합쳐진다
    { studentId: 's2', dayOfWeek: 5, startTime: '16:00', endTime: '17:00' },
    { studentId: 's2', dayOfWeek: 5, startTime: '19:00', endTime: '20:00' },
    { studentId: 's1', dayOfWeek: 5, startTime: '16:00', endTime: '17:00' },
    // 다른 요일 등록은 무시
    { studentId: 's3', dayOfWeek: 1, startTime: '16:00', endTime: '17:00' },
  ]

  it('지난 날짜: 등록명단에 있는데 기록 없으면 not_arrived, 결석 기록은 absent', () => {
    const board = getDailyAttendanceBoard(data, {
      educatorId: 'm01', dateStr: '2026-07-03', registrations, now: MONDAY_15H,
    })
    expect(board.absent.map((e) => e.student.id)).toEqual(['s1'])
    expect(board.not_arrived.map((e) => e.student.id)).toEqual(['s2'])
    // 등록명단 기준이므로 시간표만 있는 s3는 no_schedule
    expect(board.no_schedule.map((e) => e.student.id)).toEqual(['s3'])
  })

  it('여러 시간 블록은 첫 시작~마지막 종료로 합쳐 예정 시간을 만든다', () => {
    const board = getDailyAttendanceBoard(data, {
      educatorId: 'm01', dateStr: '2026-07-03', registrations, now: MONDAY_15H,
    })
    const s2 = board.not_arrived.find((e) => e.student.id === 's2')
    expect(s2.schedule).toEqual({ arrivalTime: '16:00', departureTime: '20:00' })
  })

  it('registrations가 null이면 attendance_schedules로 대체한다', () => {
    const board = getDailyAttendanceBoard(data, {
      educatorId: 'm01', dateStr: '2026-07-03', registrations: null, now: MONDAY_15H,
    })
    expect(board.not_arrived.map((e) => e.student.id)).toEqual(['s3'])
    expect(board.no_schedule.map((e) => e.student.id)).toEqual(['s2'])
  })
})

describe('isReentry — events 로그 기반 재등원 판정', () => {
  it('in 이벤트가 2개 이상이면 재등원', () => {
    expect(isReentry({ events: [{ type: 'in', at: 't1' }, { type: 'out', at: 't2' }, { type: 'in', at: 't3' }] }))
      .toBe(true)
  })
  it('in 이벤트가 1개면 재등원 아님', () => {
    expect(isReentry({ events: [{ type: 'in', at: 't1' }] })).toBe(false)
  })
  it('events 없음(구 기록·미적용)은 false', () => {
    expect(isReentry({})).toBe(false)
    expect(isReentry(null)).toBe(false)
    expect(isReentry({ events: [] })).toBe(false)
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

    // all=true(관리자)면 담당 무관 전체 미해결 알림
    const all = getUnresolvedAttendanceNotifications(data, { all: true })
    expect(all.map((n) => n.id)).toEqual(['n4', 'n3', 'n1'])
  })
})
