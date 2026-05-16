// DataContext 공용 데이터 모델 — 빈 스키마와 ID 생성 헬퍼

export const EMPTY = {
  students: [],
  educators: [],
  assignments: [],
  mindRecords: [],
  diaryRecords: [],
  learningRecords: [],
  attendanceRecords: [],
  tasks: [],
  counselingRecords: [],
  alerts: [],
  monthlyStats: [],
  schoolStats: [],
  todoItems: [],
  careerDesignResults: [],
  learningDiagnosisResults: [],
  quizSets: [],
  quizQuestions: [],
  quizAttempts: [],
}

// 도메인별 ID 생성. 기존 코드의 `${prefix}${Date.now()}` 패턴을 한 곳으로 통일.
let counter = 0
export function makeId(prefix) {
  counter += 1
  return `${prefix}${Date.now()}${counter}`
}
