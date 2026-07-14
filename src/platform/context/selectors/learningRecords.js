// [Read] 학습기록 기본 유틸 — selectors 중 최다 피참조 (actualMinutes 등).
// 학습기록(learning_records)의 시간 계산·필터 공통 함수와 학습방법·공부장소 상수.

export const STUDY_METHODS = [
  '개념학습',
  '인강듣기',
  '요점정리',
  '읽기복습',
  '백지복습',
  '암기',
  '문제풀기',
  '오답노트',
]

export const STUDY_LOCATIONS = [
  '센터',
  '집',
  '스카',
  '학원',
  '학교',
]

export function actualMinutes(record) {
  return record.actualDuration ?? record.duration ?? 0
}

export function hasActualMinutes(record) {
  return actualMinutes(record) > 0
}

export function timeTrackedRecords(records) {
  return records.filter(hasActualMinutes)
}

export function subjectBreakdown(learningRecords, limit = 8) {
  const bySubject = {}
  timeTrackedRecords(learningRecords).forEach((r) => {
    bySubject[r.subject] = (bySubject[r.subject] ?? 0) + actualMinutes(r)
  })
  return Object.entries(bySubject)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, minutes]) => ({ name, minutes }))
}

export function methodBreakdown(learningRecords, limit = 8) {
  const byMethod = {}
  timeTrackedRecords(learningRecords).forEach((r) => {
    const method = r.studyMethod || '미분류'
    byMethod[method] = (byMethod[method] ?? 0) + actualMinutes(r)
  })
  return Object.entries(byMethod)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, minutes]) => ({ name, minutes }))
}
