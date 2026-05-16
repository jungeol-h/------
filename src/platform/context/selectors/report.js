// [Read] 일/주간 리포트 집계 — data를 인자로 받는 순수함수.
// docs/3. 자료/개념 정리/리포트.md 의 리포트 항목 구성을 따른다.

import { getSelfDirectedIndex } from './indices.js'
import { lastSevenDays, getWeeklyLearning, toDateStr } from './weeklyLearning.js'
import { subjectBreakdown } from './studentView.js'

// 일간 리포트 — docs 리포트.md "학습자 개인화 리포트(일간)" 항목.
export function getDailyReport(data, studentId, dateStr) {
  const date = dateStr ?? toDateStr(new Date())

  const learning = data.learningRecords.filter(
    (r) => r.studentId === studentId && r.date === date
  )
  const tasks = data.tasks.filter((t) => t.studentId === studentId)
  const mind = data.mindRecords.find(
    (r) => r.studentId === studentId && r.date === date
  )
  const diary = data.diaryRecords.find(
    (r) => r.studentId === studentId && r.date === date
  )

  const mindTotal = mind
    ? (mind.mood ?? 0) + (mind.motivation ?? 0) + (mind.confidence ?? 0)
    : null

  return {
    date,
    totalMinutes: learning.reduce((s, r) => s + (r.duration ?? 0), 0),
    bySubject: subjectBreakdown(learning),
    taskDone: tasks.filter((t) => t.status === 'done').length,
    taskTotal: tasks.length,
    mindTotal,
    diary: diary ?? null,
  }
}

// 주간 리포트 — 최근 7일 기준. docs 리포트.md "주간 리포트" 항목.
export function getWeeklyReport(data, studentId, today = new Date()) {
  const days = lastSevenDays(today)
  const inWeek = (d) => days.includes(d)

  const learning = data.learningRecords.filter(
    (r) => r.studentId === studentId && inWeek(r.date)
  )
  const tasks = data.tasks.filter((t) => t.studentId === studentId)
  const mindInWeek = data.mindRecords.filter(
    (r) => r.studentId === studentId && inWeek(r.date)
  )

  const taskTotal = tasks.length
  const taskDone = tasks.filter((t) => t.status === 'done').length
  const focusValues = learning.map((r) => r.focus ?? 0)

  return {
    days,
    totalMinutes: learning.reduce((s, r) => s + (r.duration ?? 0), 0),
    dailyMinutes: getWeeklyLearning(data, studentId, today),
    bySubject: subjectBreakdown(learning),
    taskRate: taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : null,
    avgFocus:
      focusValues.length > 0
        ? Math.round(focusValues.reduce((s, n) => s + n, 0) / focusValues.length)
        : null,
    mindTrend: mindInWeek
      .slice()
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map((r) => ({
        date: r.date,
        total: (r.mood ?? 0) + (r.motivation ?? 0) + (r.confidence ?? 0),
      })),
    selfDirectedIndex: getSelfDirectedIndex(data, studentId),
  }
}
