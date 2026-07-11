// LearningTab 보조 순수함수 모듈 — 분 포맷, 날짜별 플래너 조회/정렬(plansForDate),
// 날짜 스트립·월 달력 배열 생성, 드래그 재정렬 sortOrder 계산 등. Vitest 단위테스트 대상.

import { toDateStr } from '../../utils/dateUtils.js'
import { actualMinutes, subjectBreakdown } from '../../context/selectors/learningRecords.js'

export function formatMinutes(minutes) {
  const value = Number(minutes || 0)
  const hours = Math.floor(value / 60)
  const mins = value % 60
  if (hours > 0 && mins > 0) return `${hours}시간 ${mins}분`
  if (hours > 0) return `${hours}시간`
  return `${mins}분`
}

export function plansForDate(records, studentId, date) {
  return records
    .filter((r) => r.studentId === studentId && r.date === date && r.recordType === 'planner')
    .slice()
    .sort((a, b) => {
      const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER
      const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) return orderA - orderB
      return a.id > b.id ? 1 : -1
    })
}

export function todayPlansFor(records, studentId, today = toDateStr(new Date())) {
  return plansForDate(records, studentId, today)
}

export function addDays(dateStr, amount) {
  const next = new Date(`${dateStr}T00:00:00`)
  next.setDate(next.getDate() + amount)
  return toDateStr(next)
}

export function addMonths(dateStr, amount) {
  const date = new Date(`${dateStr}T00:00:00`)
  return toDateStr(new Date(date.getFullYear(), date.getMonth() + amount, 1))
}

export function dateStripDays(dateStr) {
  return Array.from({ length: 7 }, (_, index) => addDays(dateStr, index - 3))
}

export function monthDays(dateStr) {
  const base = new Date(`${dateStr}T00:00:00`)
  const first = new Date(base.getFullYear(), base.getMonth(), 1)
  const startOffset = first.getDay()
  const start = new Date(first)
  start.setDate(first.getDate() - startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return toDateStr(date)
  })
}

export function buildReorderUpdates(plans, draggingId, targetId) {
  if (!draggingId || !targetId || draggingId === targetId) return []
  const fromIndex = plans.findIndex((plan) => plan.id === draggingId)
  const toIndex = plans.findIndex((plan) => plan.id === targetId)
  if (fromIndex < 0 || toIndex < 0) return []
  const reordered = plans.slice()
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  return reordered.map((plan, index) => ({ id: plan.id, sortOrder: index + 1 }))
}

export function nextSortOrder(plans) {
  const maxOrder = plans.reduce((max, plan, index) => (
    Math.max(max, plan.sortOrder ?? index + 1)
  ), 0)
  return maxOrder + 1
}

export function todaySubjectBreakdown(records, today = toDateStr(new Date()), limit = 5) {
  return subjectBreakdown(
    records.filter((r) => r.date === today && actualMinutes(r) > 0),
    limit
  )
}
