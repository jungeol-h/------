// [Read] 종합 성찰 리포트용 props 조립 — data를 인자로 받는 순수함수.
// 여러 selector 결과를 ReflectionReport 컴포넌트가 기대하는 형태로 합친다.

import { actualMinutes, timeTrackedRecords } from './learningRecords.js'
import { getSelfDirectedIndex, getEmotionStability } from './indices.js'
import { getAttendanceSummary } from './attendanceStats.js'
import { toDateStr } from './weeklyLearning.js'

// 오늘 기준 최근 4주(주=7일)의 주별 학습시간 합계. 최근 주가 위로 오도록 정렬.
// [{ label: 'M/D~M/D', minutes }]
export function getLast4WeeksLearning(learningRecords, studentId, today = new Date()) {
  const base = new Date(today)
  base.setHours(0, 0, 0, 0)
  const weeks = []
  for (let w = 0; w < 4; w += 1) {
    const end = new Date(base)
    end.setDate(end.getDate() - w * 7)
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    const startStr = toDateStr(start)
    const endStr = toDateStr(end)
    const minutes = timeTrackedRecords(learningRecords)
      .filter(
        (r) => r.studentId === studentId && r.date >= startStr && r.date <= endStr
      )
      .reduce((sum, r) => sum + actualMinutes(r), 0)
    const label = `${start.getMonth() + 1}/${start.getDate()}~${end.getMonth() + 1}/${end.getDate()}`
    weeks.push({ label, minutes })
  }
  return weeks
}

// 마인드 기록 평균(mood/motivation/confidence) + 정서 안정도.
export function getMindSummary(data, studentId) {
  const records = (data?.mindRecords ?? []).filter((r) => r.studentId === studentId)
  if (records.length === 0) {
    return {
      avgMood: null,
      avgMotivation: null,
      avgConfidence: null,
      stability: getEmotionStability(data, studentId),
      recentCount: 0,
    }
  }
  const avg = (key) =>
    records.reduce((s, r) => s + (r[key] ?? 0), 0) / records.length
  return {
    avgMood: avg('mood'),
    avgMotivation: avg('motivation'),
    avgConfidence: avg('confidence'),
    stability: getEmotionStability(data, studentId),
    recentCount: records.length,
  }
}

// ReflectionReport props의 데이터 부분(attendance/learning/mind)을 조립.
// student/generatedAt/author 는 호출부에서 붙인다.
export function buildReflectionData(data, studentId, today = new Date()) {
  const attendance = getAttendanceSummary(data, studentId)

  const totalMinutes = timeTrackedRecords(data?.learningRecords ?? [])
    .filter((r) => r.studentId === studentId)
    .reduce((sum, r) => sum + actualMinutes(r), 0)

  const learning = {
    totalMinutes,
    selfIndex: getSelfDirectedIndex(data, studentId),
    weekly: getLast4WeeksLearning(data?.learningRecords ?? [], studentId, today),
  }

  const mind = getMindSummary(data, studentId)

  return { attendance, learning, mind }
}
