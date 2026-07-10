// [Read] 학생 목록용 지표 일괄 산출 — data를 인자로 받는 순수함수.
//
// 관리자 '학생' 탭 목록의 출결/학습/마인드/과제/일정 컬럼용.
// 행마다 selector를 부르면 O(학생수 × 레코드수)라, 각 레코드 배열을
// 1-pass로 훑어 Map(studentId → 지표)을 만들어 useMemo 1회 계산으로 쓴다.

import { toDateStr, lastSevenDays } from './weeklyLearning.js'
import { actualMinutes } from './learningRecords.js'
import { ATTENDANCE_CAUTION_DAYS } from './attendanceStats.js'
import { evaluateMindLevel, MIND_CAUTION_THRESHOLD } from './riskDetection.js'
import { getStudentWorkPlanCounts } from './workPlans.js'

// 마인드 배지 판정 — 최근 기록 기준. 기록 없으면 null.
// danger → '위험', warning 또는 단일 지표 -3 이하 → '주의', 그 외 '양호'
function mindBadge(latest) {
  if (!latest) return null
  const level = evaluateMindLevel(latest)
  if (level === 'danger') return 'risk'
  const caution =
    latest.mood <= MIND_CAUTION_THRESHOLD ||
    latest.motivation <= MIND_CAUTION_THRESHOLD ||
    latest.confidence <= MIND_CAUTION_THRESHOLD
  return level === 'warning' || caution ? 'caution' : 'good'
}

// 반환: Map(studentId → {
//   absentCount,                    출결: 최근 30일 결석 횟수
//   fulfillment: {rate,...}|null,   학습: 최근 7일 이행률 (계획 없으면 null)
//   mind: 'good'|'caution'|'risk'|null,
//   tasksDone, tasksTotal,          과제
//   planCount,                      일정: 업무계획 태그 횟수
// })
export function getStudentIndicatorMap(data, today = new Date()) {
  const map = new Map()
  const get = (id) => {
    if (!map.has(id)) {
      map.set(id, {
        absentCount: 0,
        _plannedMin: 0,
        _actualMin: 0,
        fulfillment: null,
        _latestMind: null,
        mind: null,
        tasksDone: 0,
        tasksTotal: 0,
        planCount: 0,
      })
    }
    return map.get(id)
  }

  // 출결 — 최근 30일 결석
  const attendanceSince = new Date(today)
  attendanceSince.setDate(attendanceSince.getDate() - ATTENDANCE_CAUTION_DAYS)
  const attendanceSinceStr = toDateStr(attendanceSince)
  ;(data?.attendanceRecords ?? []).forEach((r) => {
    if (r.status !== 'absent' || String(r.date) < attendanceSinceStr) return
    get(r.studentId).absentCount += 1
  })

  // 학습 — 최근 7일 계획 대비 이행률 (getWeeklyFulfillment와 동일 규칙의 1-pass 판)
  const weekDays = new Set(lastSevenDays(today))
  ;(data?.learningRecords ?? []).forEach((r) => {
    if (!weekDays.has(r.date)) return
    const ind = get(r.studentId)
    ind._plannedMin += r.plannedMin ?? 0
    ind._actualMin += actualMinutes(r)
  })

  // 마인드 — 최근 기록 1건 판정
  ;(data?.mindRecords ?? []).forEach((r) => {
    const ind = get(r.studentId)
    if (!ind._latestMind || String(r.date) > String(ind._latestMind.date)) {
      ind._latestMind = r
    }
  })

  // 과제 — 완료/전체
  ;(data?.tasks ?? []).forEach((t) => {
    const ind = get(t.studentId)
    ind.tasksTotal += 1
    if (t.status === 'done') ind.tasksDone += 1
  })

  // 일정 — 업무계획 태그 횟수
  getStudentWorkPlanCounts(data).forEach((count, sid) => {
    get(sid).planCount = count
  })

  // 파생값 확정 + 내부 누적 필드 정리
  map.forEach((ind) => {
    if (ind._plannedMin > 0) {
      ind.fulfillment = {
        plannedMin: ind._plannedMin,
        actualMin: ind._actualMin,
        rate: ind._actualMin / ind._plannedMin,
      }
    }
    ind.mind = mindBadge(ind._latestMind)
    delete ind._plannedMin
    delete ind._actualMin
    delete ind._latestMind
  })

  return map
}
