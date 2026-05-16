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
  // 침묵 실패 방지용 메타. fetch 시점에 채워진다.
  _fetchErrors: [], // [{ table, message }] — 로드 실패한 쿼리
  _fetchMeta: {},   // { tableName: { fetched, total } } — limit 잘림 탐지
}

// 도메인별 ID 생성. 기존 코드의 `${prefix}${Date.now()}` 패턴을 한 곳으로 통일.
let counter = 0
export function makeId(prefix) {
  counter += 1
  return `${prefix}${Date.now()}${counter}`
}
