// [Read] 학생 1명의 출결 누적 통계 — data를 인자로 받는 순수함수
//
// 판정(present/late/absent, early_leave)은 이미 서버가 확정한 값이다.
// 여기서는 그 값을 세고, 화면·PDF용으로 날짜 내림차순 정리만 한다.
// present/late/absent는 status 기준, earlyLeave는 checkoutStatus 기준으로
// 서로 독립 집계한다(지각이면서 조퇴한 날은 late·earlyLeave 양쪽에 카운트).

import { toDateStr } from '../../utils/dateUtils.js'
import { getDailyAttendanceBoard } from './attendance.js'

// 출결 주의 판정 임계 — 최근 30일 결석 3회 이상 (관리자 대시보드 핵심지표)
export const ATTENDANCE_CAUTION_DAYS = 30
export const ATTENDANCE_CAUTION_ABSENT_THRESHOLD = 3

// 출결 주의 학생 목록 — 최근 N일 결석 횟수가 임계 이상인 active 학생.
// 결석 많은 순 정렬. 반환: [{ student, absentCount }]
export function getAttendanceCautionStudents(data, { today = new Date() } = {}) {
  const since = new Date(today)
  since.setDate(since.getDate() - ATTENDANCE_CAUTION_DAYS)
  const sinceStr = toDateStr(since) // 로컬 날짜 기준 (UTC 변환 시 하루 밀림 방지)

  const absentByStudent = {}
  ;(data?.attendanceRecords ?? []).forEach((r) => {
    if (r.status !== 'absent') return
    if (String(r.date) < sinceStr) return
    absentByStudent[r.studentId] = (absentByStudent[r.studentId] ?? 0) + 1
  })

  return (data?.students ?? [])
    .filter((s) => (s.status ?? 'active') === 'active')
    .map((s) => ({ student: s, absentCount: absentByStudent[s.id] ?? 0 }))
    .filter((x) => x.absentCount >= ATTENDANCE_CAUTION_ABSENT_THRESHOLD)
    .sort((a, b) => b.absentCount - a.absentCount)
}

// 그룹별 오늘(또는 지정일) 출결 집계 — 관리자 홈 대시보드용.
// getDailyAttendanceBoard(all=true)로 전체 active 학생의 상태를 구한 뒤 그룹으로 나눈다.
// groups: 표시할 그룹명 배열(빈 배열이면 전체 그룹). 각 학생은 groups[0](대표 그룹)로 귀속하고,
// 소속 그룹이 없으면 '무소속'으로 묶는다.
// 반환: { rows: [{ group, total, present, late, absent, checkedOut, notArrived, noSchedule }], totals }
export function getGroupAttendanceSummary(data, { dateStr, groups = [], now = new Date() } = {}) {
  const board = getDailyAttendanceBoard(data, { all: true, dateStr, now })

  const NO_GROUP = '무소속'
  // 상태별 학생을 순회하며 그룹 버킷에 합산.
  const buckets = new Map() // group → counts
  const ensure = (g) => {
    if (!buckets.has(g)) {
      buckets.set(g, { group: g, total: 0, present: 0, late: 0, absent: 0, checkedOut: 0, notArrived: 0, noSchedule: 0 })
    }
    return buckets.get(g)
  }

  const addEntry = (entry, bump) => {
    const g = entry.student.groups?.[0] || NO_GROUP
    // 필터가 지정돼 있으면 해당 그룹만(무소속은 필터에 없으면 제외).
    if (groups.length > 0 && !groups.includes(g)) return
    const b = ensure(g)
    b.total += 1
    bump(b)
  }

  board.present.forEach((e) => addEntry(e, (b) => (b.present += 1)))
  board.late.forEach((e) => addEntry(e, (b) => (b.late += 1)))
  board.absent.forEach((e) => addEntry(e, (b) => (b.absent += 1)))
  // 하원·조퇴는 '등원했다'는 관점에서 present로 함께 센다(오늘 출석 여부 집계).
  board.checked_out.forEach((e) => addEntry(e, (b) => { b.present += 1; b.checkedOut += 1 }))
  board.early_leave.forEach((e) => addEntry(e, (b) => { b.present += 1; b.checkedOut += 1 }))
  board.not_arrived.forEach((e) => addEntry(e, (b) => (b.notArrived += 1)))
  board.waiting.forEach((e) => addEntry(e, (b) => (b.notArrived += 1)))
  board.no_schedule.forEach((e) => addEntry(e, (b) => (b.noSchedule += 1)))

  // 필터에 지정됐지만 인원이 0인 그룹도 행으로 노출(집계가 비어 보이지 않게).
  groups.forEach((g) => ensure(g))

  // 정렬: 필터 순서 우선, 그 외는 인원 많은 순, 무소속은 항상 마지막.
  const orderIndex = (g) => {
    if (g === NO_GROUP) return Infinity
    const i = groups.indexOf(g)
    return i === -1 ? groups.length : i
  }
  const rows = [...buckets.values()].sort((a, b) => {
    const oi = orderIndex(a.group) - orderIndex(b.group)
    if (oi !== 0) return oi
    return b.total - a.total
  })

  const totals = rows.reduce(
    (acc, r) => {
      acc.total += r.total; acc.present += r.present; acc.late += r.late
      acc.absent += r.absent; acc.checkedOut += r.checkedOut
      acc.notArrived += r.notArrived; acc.noSchedule += r.noSchedule
      return acc
    },
    { total: 0, present: 0, late: 0, absent: 0, checkedOut: 0, notArrived: 0, noSchedule: 0 }
  )

  return { rows, totals }
}

export function getAttendanceSummary(data, studentId) {
  const records = (data?.attendanceRecords ?? []).filter(
    (r) => r.studentId === studentId
  )

  const counts = { present: 0, late: 0, earlyLeave: 0, absent: 0 }
  records.forEach((r) => {
    if (r.status === 'present') counts.present += 1
    else if (r.status === 'late') counts.late += 1
    else if (r.status === 'absent') counts.absent += 1
    if (r.checkoutStatus === 'early_leave') counts.earlyLeave += 1
  })

  const sorted = records
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((r) => ({
      id: r.id,
      date: r.date,
      status: r.status,
      checkoutStatus: r.checkoutStatus ?? null,
      checkInAt: r.checkInAt ?? null,
      checkOutAt: r.checkOutAt ?? null,
    }))

  return { counts, records: sorted }
}
