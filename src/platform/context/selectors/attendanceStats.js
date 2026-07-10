import { toDateStr } from './weeklyLearning.js'

// [Read] 학생 1명의 출결 누적 통계 — data를 인자로 받는 순수함수
//
// 판정(present/late/absent, early_leave)은 이미 서버가 확정한 값이다.
// 여기서는 그 값을 세고, 화면·PDF용으로 날짜 내림차순 정리만 한다.
// present/late/absent는 status 기준, earlyLeave는 checkoutStatus 기준으로
// 서로 독립 집계한다(지각이면서 조퇴한 날은 late·earlyLeave 양쪽에 카운트).

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
