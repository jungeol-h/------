import { describe, it, expect } from 'vitest'
import { buildAttendanceGrid, __test__ } from './attendanceExcel.js'

const { buildWeeks, buildSlots } = __test__

// 로컬(테스트 실행 TZ) 벽시계 기준 ISO 문자열 생성 — new Date(...).toISOString()은
// UTC로 저장되지만, 빌더가 로컬 getHours()로 읽으므로 왕복 후 동일 벽시계로 복원된다.
function localIso(year, month, day, hour, minute) {
  return new Date(year, month - 1, day, hour, minute, 0).toISOString()
}

const students = [
  { id: 's1', name: '김학생', school: '산청중', grade: '중1' },
  { id: 's2', name: '이학생', school: '안동중', grade: '중2' },
]

describe('buildWeeks', () => {
  it('월 시작이 수요일인 달(2026-07)의 주차 분할', () => {
    // 2026-07-01은 수요일. 첫 주는 6/29(월)~7/5(일).
    const weeks = buildWeeks(2026, 7)
    expect(weeks[0].name).toBe('1주차')
    // 첫 주: 월,화는 6월(밖)이라 null, 수(7/1)부터 채워짐
    expect(weeks[0].days[0].date).toBeNull()
    expect(weeks[0].days[1].date).toBeNull()
    expect(weeks[0].days[2].date).toBe('2026-07-01')
    expect(weeks[0].days[6].date).toBe('2026-07-05')
    // 마지막 날 7/31(금)이 마지막 주에 포함
    const lastWeek = weeks[weeks.length - 1]
    const dates = lastWeek.days.map((d) => d.date).filter(Boolean)
    expect(dates).toContain('2026-07-31')
  })

  it('월 시작이 월요일인 달(2026-06)은 1주차 첫 칸이 1일', () => {
    // 2026-06-01은 월요일
    const weeks = buildWeeks(2026, 6)
    expect(weeks[0].days[0].date).toBe('2026-06-01')
  })

  it('모든 주는 7일 열을 가진다', () => {
    const weeks = buildWeeks(2026, 2)
    for (const wk of weeks) expect(wk.days).toHaveLength(7)
  })
})

describe('buildSlots', () => {
  it('30분 단위 09:00~10:00 → 2슬롯', () => {
    const slots = buildSlots(540, 600, 30)
    expect(slots).toHaveLength(2)
    expect(slots[0].label).toBe('09:00~09:30')
    expect(slots[1].label).toBe('09:30~10:00')
  })

  it('1시간 단위 09:00~22:00 → 13슬롯', () => {
    expect(buildSlots(540, 1320, 60)).toHaveLength(13)
  })

  it('마지막 슬롯은 endMinutes에서 잘린다(2시간 단위 09:00~14:00)', () => {
    const slots = buildSlots(540, 840, 120)
    expect(slots[slots.length - 1].label).toBe('13:00~14:00')
  })
})

describe('buildAttendanceGrid — 버킷팅과 태그', () => {
  const base = { year: 2026, month: 7, slotMinutes: 30, startMinutes: 540, endMinutes: 1320 }

  it('슬롯 경계값: start는 포함, end는 다음 슬롯', () => {
    const records = [
      { studentId: 's1', date: '2026-07-01', status: 'present', checkInAt: localIso(2026, 7, 1, 9, 0), checkoutStatus: 'normal' },
      { studentId: 's2', date: '2026-07-01', status: 'present', checkInAt: localIso(2026, 7, 1, 9, 30), checkoutStatus: 'normal' },
    ]
    const { weeks } = buildAttendanceGrid({ records, students, ...base })
    const week1 = weeks[0]
    const colIdx = week1.days.findIndex((d) => d.date === '2026-07-01')
    // row0 = 09:00~09:30 → s1, row1 = 09:30~10:00 → s2
    expect(week1.rows[0].cells[colIdx].entries.map((e) => e.text)).toEqual(['김학생(산청중/중1)'])
    expect(week1.rows[1].cells[colIdx].entries.map((e) => e.text)).toEqual(['이학생(안동중/중2)'])
  })

  it('태그 조합: 지각+조퇴, 지각만, 조퇴만, 태그없음', () => {
    const records = [
      { studentId: 's1', date: '2026-07-01', status: 'late', checkInAt: localIso(2026, 7, 1, 9, 10), checkoutStatus: 'early_leave' },
      { studentId: 's2', date: '2026-07-01', status: 'late', checkInAt: localIso(2026, 7, 1, 9, 10), checkoutStatus: 'normal' },
      { studentId: 's1', date: '2026-07-02', status: 'present', checkInAt: localIso(2026, 7, 2, 9, 10), checkoutStatus: 'early_leave' },
      { studentId: 's2', date: '2026-07-02', status: 'present', checkInAt: localIso(2026, 7, 2, 9, 10), checkoutStatus: 'normal' },
    ]
    const { weeks } = buildAttendanceGrid({ records, students, ...base })
    const w = weeks[0]
    const c1 = w.days.findIndex((d) => d.date === '2026-07-01')
    const c2 = w.days.findIndex((d) => d.date === '2026-07-02')
    const day1 = w.rows[0].cells[c1].entries
    const day2 = w.rows[0].cells[c2].entries
    expect(day1.find((e) => e.text.startsWith('김학생')).tags).toEqual(['지각', '조퇴'])
    expect(day1.find((e) => e.text.startsWith('이학생')).tags).toEqual(['지각'])
    expect(day2.find((e) => e.text.startsWith('김학생')).tags).toEqual(['조퇴'])
    expect(day2.find((e) => e.text.startsWith('이학생')).tags).toEqual([])
  })

  it('check_in_at 없는 레코드(결석)는 제외', () => {
    const records = [
      { studentId: 's1', date: '2026-07-01', status: 'absent', checkInAt: null, checkoutStatus: null },
    ]
    const { weeks } = buildAttendanceGrid({ records, students, ...base })
    const total = weeks.flatMap((w) => w.rows).flatMap((r) => r.cells).flatMap((c) => c.entries)
    expect(total).toHaveLength(0)
  })

  it('범위 밖 시각(08:00, 23:00)은 제외', () => {
    const records = [
      { studentId: 's1', date: '2026-07-01', status: 'present', checkInAt: localIso(2026, 7, 1, 8, 0), checkoutStatus: 'normal' },
      { studentId: 's2', date: '2026-07-01', status: 'present', checkInAt: localIso(2026, 7, 1, 23, 0), checkoutStatus: 'normal' },
    ]
    const { weeks } = buildAttendanceGrid({ records, students, ...base })
    const total = weeks.flatMap((w) => w.rows).flatMap((r) => r.cells).flatMap((c) => c.entries)
    expect(total).toHaveLength(0)
  })

  it('빈 데이터: 주차 구조는 유지되고 모든 셀이 비어있다', () => {
    const { weeks } = buildAttendanceGrid({ records: [], students, ...base })
    expect(weeks.length).toBeGreaterThan(0)
    const total = weeks.flatMap((w) => w.rows).flatMap((r) => r.cells).flatMap((c) => c.entries)
    expect(total).toHaveLength(0)
  })

  it('학생 정보 없으면 이름만/알수없음 처리', () => {
    const records = [
      { studentId: 'ghost', date: '2026-07-01', status: 'present', checkInAt: localIso(2026, 7, 1, 10, 0), checkoutStatus: 'normal' },
    ]
    const { weeks } = buildAttendanceGrid({ records, students: [], ...base })
    const entries = weeks.flatMap((w) => w.rows).flatMap((r) => r.cells).flatMap((c) => c.entries)
    expect(entries[0].text).toBe('(알수없음)')
  })
})
