import { describe, it, expect } from 'vitest'
import {
  snapMinutes,
  sessionMinutesOf,
  minutesToText,
  buildMonthlyCounselingStats,
  buildMonthlyLessonStats,
  buildAttendanceUsage,
} from './monthlyOperationsReport.js'

describe('snapMinutes', () => {
  it('50~70분은 60분으로 스냅, 그 외는 실측 유지', () => {
    expect(snapMinutes(49)).toBe(49)
    expect(snapMinutes(50)).toBe(60)
    expect(snapMinutes(60)).toBe(60)
    expect(snapMinutes(70)).toBe(60)
    expect(snapMinutes(71)).toBe(71)
    expect(snapMinutes(20)).toBe(20)
  })
})

describe('sessionMinutesOf', () => {
  it('시간 미입력·역전은 fallback', () => {
    expect(sessionMinutesOf('', '', 20)).toBe(20)
    expect(sessionMinutesOf('14:00', '', 40)).toBe(40)
    expect(sessionMinutesOf('15:00', '14:00', 60)).toBe(60)
  })

  it('실측 분에 스냅 적용', () => {
    expect(sessionMinutesOf('14:00', '14:47', 20)).toBe(47)
    expect(sessionMinutesOf('14:00', '15:05', 20)).toBe(60)
  })
})

describe('minutesToText', () => {
  it('시간·분 표기', () => {
    expect(minutesToText(0)).toBe('0분')
    expect(minutesToText(40)).toBe('40분')
    expect(minutesToText(60)).toBe('1시간')
    expect(minutesToText(100)).toBe('1시간 40분')
  })
})

describe('buildMonthlyCounselingStats', () => {
  const educators = [
    { id: 'e1', name: '황광희', subject: '국어' },
    { id: 'e2', name: '최인선', subject: '' },
  ]
  const base = { topic: '주제', diagnosis: '', advice: '', followUp: '', note: '' }

  it('교과 컨설팅 20분×3(시간 미입력 포함)은 60분 = 1.0시수', () => {
    const records = [
      { id: 'r1', studentId: 's1', educatorId: 'e1', date: '2026-07-04', type: 'subject_learning', startTime: '14:00', endTime: '14:20', ...base },
      { id: 'r2', studentId: 's1', educatorId: 'e1', date: '2026-07-11', type: 'subject_learning', startTime: '14:00', endTime: '14:20', ...base, topic: '주제2' },
      // 시간 미입력 → 20분 간주
      { id: 'r3', studentId: 's1', educatorId: 'e1', date: '2026-07-18', type: 'subject_learning', startTime: '', endTime: '', ...base, topic: '주제3' },
    ]
    const { rows, totals } = buildMonthlyCounselingStats(records, educators, '2026-07')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: '황광희(국어)', category: '교과·기타 컨설팅', sessions: 3, minutes: 60, hours: 1,
    })
    expect(totals.minutesText).toBe('1시간')
  })

  it('진로진학(구 진로 포함)은 40분 = 1시수로 분리 집계', () => {
    const records = [
      { id: 'r1', studentId: 's1', educatorId: 'e1', date: '2026-07-04', type: 'career_path', startTime: '14:00', endTime: '14:40', ...base },
      { id: 'r2', studentId: 's1', educatorId: 'e1', date: '2026-07-11', type: 'career', startTime: '', endTime: '', ...base, topic: '주제2' },
      { id: 'r3', studentId: 's1', educatorId: 'e1', date: '2026-07-11', type: 'subject_learning', startTime: '10:00', endTime: '10:20', ...base, topic: '주제3' },
    ]
    const { rows } = buildMonthlyCounselingStats(records, educators, '2026-07')
    expect(rows.map((r) => r.category)).toEqual(['교과·기타 컨설팅', '진로진학 컨설팅'])
    const career = rows.find((r) => r.category === '진로진학 컨설팅')
    expect(career).toMatchObject({ sessions: 2, minutes: 80, hours: 2 })
  })

  it('그룹 상담 fan-out은 1세션으로 센다', () => {
    const session = { date: '2026-07-04', type: 'subject_learning', startTime: '14:00', endTime: '14:20', ...base }
    const records = [
      { id: 'r1', studentId: 's1', educatorId: 'e1', ...session },
      { id: 'r2', studentId: 's2', educatorId: 'e1', ...session },
      { id: 'r3', studentId: 's3', educatorId: 'e1', ...session },
    ]
    const { rows } = buildMonthlyCounselingStats(records, educators, '2026-07')
    expect(rows[0].sessions).toBe(1)
    expect(rows[0].minutes).toBe(20)
  })

  it('월 필터 — 다른 달 기록 제외, 강사 이름순 정렬', () => {
    const records = [
      { id: 'r1', studentId: 's1', educatorId: 'e1', date: '2026-06-30', type: 'subject_learning', ...base },
      { id: 'r2', studentId: 's1', educatorId: 'e2', date: '2026-07-04', type: 'subject_learning', ...base },
      { id: 'r3', studentId: 's1', educatorId: 'e1', date: '2026-07-05', type: 'subject_learning', ...base },
    ]
    const { rows } = buildMonthlyCounselingStats(records, educators, '2026-07')
    expect(rows.map((r) => r.name)).toEqual(['최인선', '황광희(국어)'])
  })
})

describe('buildMonthlyLessonStats', () => {
  const educators = [{ id: 'cs01', name: '김재형', subject: null }]

  it('50분 스냅 + 시간 미입력 60분 간주, 60분 = 1시수', () => {
    const reports = [
      { id: 'l1', authorId: 'cs01', date: '2026-07-23', startTime: '15:00', endTime: '15:50' },
      { id: 'l2', authorId: 'cs01', date: '2026-07-24', startTime: '', endTime: '' },
    ]
    const { rows, totals } = buildMonthlyLessonStats(reports, educators, '2026-07')
    expect(rows[0]).toMatchObject({ name: '김재형', sessions: 2, minutes: 120, hours: 2 })
    expect(totals.minutesText).toBe('2시간')
  })

  it('월 밖 기록 제외', () => {
    const reports = [{ id: 'l1', authorId: 'cs01', date: '2026-08-01', startTime: '', endTime: '' }]
    expect(buildMonthlyLessonStats(reports, educators, '2026-07').rows).toHaveLength(0)
  })
})

describe('buildAttendanceUsage', () => {
  it('출석+지각만 연인원, 이용시간은 입실~퇴실 간격 합', () => {
    const rows = [
      { status: 'present', checkInAt: '2026-07-04T09:00:00+09:00', checkOutAt: '2026-07-04T12:30:00+09:00' },
      { status: 'late', checkInAt: '2026-07-04T10:00:00+09:00', checkOutAt: '2026-07-04T12:00:00+09:00' },
      { status: 'absent', checkInAt: null, checkOutAt: null },
    ]
    const { presentCount, usageMinutes, usageText } = buildAttendanceUsage(rows)
    expect(presentCount).toBe(2)
    expect(usageMinutes).toBe(210 + 120)
    expect(usageText).toBe('5시간 30분')
  })

  it('재등원(events in/out 쌍)은 실제 체류 구간 합으로 — 전체 간격 과대집계 방지', () => {
    const rows = [
      {
        status: 'present',
        checkInAt: '2026-07-04T09:00:00+09:00',
        checkOutAt: '2026-07-04T18:00:00+09:00',
        events: [
          { type: 'in', at: '2026-07-04T09:00:00+09:00' },
          { type: 'out', at: '2026-07-04T12:00:00+09:00' },
          { type: 'in', at: '2026-07-04T14:00:00+09:00' },
          { type: 'out', at: '2026-07-04T18:00:00+09:00' },
        ],
      },
    ]
    expect(buildAttendanceUsage(rows).usageMinutes).toBe(180 + 240)
  })

  it('미퇴실 입실은 최종 퇴실 시각으로 보정, 퇴실 정보 없으면 0', () => {
    const rows = [
      {
        status: 'present',
        checkInAt: '2026-07-04T09:00:00+09:00',
        checkOutAt: '2026-07-04T13:00:00+09:00',
        events: [{ type: 'in', at: '2026-07-04T12:00:00+09:00' }],
      },
      { status: 'present', checkInAt: '2026-07-04T09:00:00+09:00', checkOutAt: null },
    ]
    expect(buildAttendanceUsage(rows).usageMinutes).toBe(60)
  })
})
