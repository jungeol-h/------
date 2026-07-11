// [Read] 최근 7일 학습시간 집계 — data를 인자로 받는 순수함수

import { actualMinutes } from './learningRecords.js'
import { toDateStr } from '../../utils/dateUtils.js'

// 오늘 기준 최근 7일의 날짜 문자열(YYYY-MM-DD) 배열. 과거→오늘 순.
export function lastSevenDays(today = new Date()) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(toDateStr(d))
  }
  return days
}

// 한 학생의 최근 7일 일별 학습시간 합계. [{ day: 'MM-DD', minutes }]
export function getWeeklyLearning(data, studentId, today = new Date()) {
  return lastSevenDays(today).map((date) => {
    const minutes = data.learningRecords
      .filter((r) => r.studentId === studentId && r.date === date)
      .reduce((sum, r) => sum + actualMinutes(r), 0)
    return { day: date.slice(5), minutes }
  })
}

// 학습 주의 판정 임계 — 최근 7일 계획 대비 이행률 60% 미만 (관리자 대시보드 핵심지표)
export const LEARNING_CAUTION_RATE = 0.6

// 한 학생의 최근 7일 계획(plannedMin 합) 대비 실제 학습시간 이행률.
// 계획이 없으면(plannedMin 합 0) null — 판정 대상 아님.
// 반환: { plannedMin, actualMin, rate } | null
export function getWeeklyFulfillment(data, studentId, today = new Date()) {
  const days = new Set(lastSevenDays(today))
  const records = (data?.learningRecords ?? []).filter(
    (r) => r.studentId === studentId && days.has(r.date)
  )
  const plannedMin = records.reduce((sum, r) => sum + (r.plannedMin ?? 0), 0)
  if (plannedMin === 0) return null
  const actualMin = records.reduce((sum, r) => sum + actualMinutes(r), 0)
  return { plannedMin, actualMin, rate: actualMin / plannedMin }
}

// 학습 주의 학생 목록 — 이행률이 임계 미만인 active 학생.
// 계획이 없는 학생은 판정 제외. 이행률 낮은 순 정렬.
// 반환: [{ student, plannedMin, actualMin, rate }]
export function getLearningCautionStudents(data, today = new Date()) {
  return (data?.students ?? [])
    .filter((s) => (s.status ?? 'active') === 'active')
    .map((s) => {
      const f = getWeeklyFulfillment(data, s.id, today)
      if (!f || f.rate >= LEARNING_CAUTION_RATE) return null
      return { student: s, ...f }
    })
    .filter(Boolean)
    .sort((a, b) => a.rate - b.rate)
}
