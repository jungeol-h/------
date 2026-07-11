// [Read] 관리자 홈 하단 통계 확장 — data를 인자로 받는 순수함수.
// 누적 출결 / 학습시간 평균 / 업무횟수(상담 유형별)

import { toDateStr } from '../../utils/dateUtils.js'
import { actualMinutes } from './learningRecords.js'
import { COUNSELING_TYPE_LABELS } from '../../data/counselingTypes.js'

// 출결 합계 — 관리자 fetch가 60일 윈도라 "최근 60일" 라벨과 함께 쓴다.
// 반환: { present, late, absent, earlyLeave }
export function getAttendanceTotals(data) {
  const totals = { present: 0, late: 0, absent: 0, earlyLeave: 0 }
  ;(data?.attendanceRecords ?? []).forEach((r) => {
    if (r.status === 'present') totals.present += 1
    else if (r.status === 'late') totals.late += 1
    else if (r.status === 'absent') totals.absent += 1
    if (r.checkoutStatus === 'early_leave') totals.earlyLeave += 1
  })
  return totals
}

// 최근 N일 active 학생 1인당 평균 학습시간(분).
// 학습기록 있는 학생만이 아니라 active 학생 전체로 나눈다 — "센터 평균" 의미.
export function getAvgLearningMinutes(data, { days = 30, today = new Date() } = {}) {
  const activeStudents = (data?.students ?? []).filter(
    (s) => (s.status ?? 'active') === 'active'
  )
  if (activeStudents.length === 0) return 0
  const activeIds = new Set(activeStudents.map((s) => s.id))
  const since = new Date(today)
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = toDateStr(since)

  const totalMin = (data?.learningRecords ?? [])
    .filter((r) => activeIds.has(r.studentId) && String(r.date) >= sinceStr)
    .reduce((sum, r) => sum + actualMinutes(r), 0)
  return Math.round(totalMin / activeStudents.length)
}

// 업무횟수 — 상담기록 유형별 카운트, 많은 순. 구 체계 값도 라벨로 표시.
// 반환: [{ type, label, count }]
export function getCounselingTypeCounts(data) {
  const counts = {}
  ;(data?.counselingRecords ?? []).forEach((r) => {
    const type = r.type ?? 'etc'
    counts[type] = (counts[type] ?? 0) + 1
  })
  return Object.entries(counts)
    .map(([type, count]) => ({ type, label: COUNSELING_TYPE_LABELS[type] ?? type, count }))
    .sort((a, b) => b.count - a.count)
}
