// 확인평가 회차별 요약 계산 — QuizMonitorTab(요약 카드)과 QuizReportModal(PDF)이 공용하는 순수 함수.
// 대상(eligible)은 회차 학년과 일치하는 학생 전원 기준 (기존 QuizMonitorTab 계산을 그대로 추출).

import { hasPendingGrading } from './quizGrading.js'

// 회차별 응시자 수 / 미응시자 수 / 미채점 / 평균 정답률
// attempts는 전체를 넘겨도 회차별로 자체 필터하므로 부분집합·전체 어느 쪽이든 안전하다.
export function buildQuizSummaries(quizSets, attempts, students) {
  return quizSets.map((set) => {
    // '전체' 학년 세트는 전 학년 대상 — students는 상위에서 이미 스코프된 목록이므로 그대로 사용
    const eligible = set.grade === '전체' ? students : students.filter((s) => s.grade === set.grade)
    const setAttempts = attempts.filter((a) => a.quizSetId === set.id)
    const submittedIds = new Set(setAttempts.map((a) => a.studentId))
    const submittedCount = setAttempts.length
    const eligibleCount = eligible.length
    const missingCount = eligible.filter((s) => !submittedIds.has(s.id)).length
    const pendingCount = setAttempts.filter(hasPendingGrading).length
    const avgPct = setAttempts.length > 0
      ? Math.round(setAttempts.reduce((sum, a) => sum + (a.total > 0 ? a.score / a.total : 0), 0) / setAttempts.length * 100)
      : 0
    return { set, eligibleCount, submittedCount, missingCount, pendingCount, avgPct }
  })
}
