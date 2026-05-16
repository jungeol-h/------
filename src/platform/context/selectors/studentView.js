// [Read] 학생 중심 종합 뷰 — 학생을 Aggregate Root로, 한 학생의 전 도메인
// 데이터를 한 번에 묶어 돌려주는 순수함수. StudentDetailPage 등 종합 뷰가
// 각자 흩어서 하던 filter+sort를 한 곳으로 모은다.

const byDateDesc = (a, b) => (b.date > a.date ? 1 : -1)

// 한 학생의 모든 도메인 데이터를 필터링·정렬해 묶는다.
export function getStudentView(data, studentId) {
  const student = data.students.find((s) => s.id === studentId) ?? null

  const managerIds = data.assignments
    .filter((a) => a.studentId === studentId)
    .map((a) => a.educatorId)
  const managers = data.educators.filter(
    (e) => managerIds.includes(e.id) && e.role === 'manager'
  )

  return {
    student,
    managers,
    hasUnresolvedAlert: data.alerts.some(
      (a) => a.studentId === studentId && !a.resolved
    ),
    mindRecords: data.mindRecords
      .filter((r) => r.studentId === studentId)
      .slice()
      .sort(byDateDesc),
    diaryRecords: data.diaryRecords
      .filter((r) => r.studentId === studentId)
      .slice()
      .sort(byDateDesc),
    learningRecords: data.learningRecords
      .filter((r) => r.studentId === studentId)
      .slice()
      .sort(byDateDesc),
    tasks: data.tasks
      .filter((t) => t.studentId === studentId)
      .slice()
      .sort((a, b) => (b.dueDate > a.dueDate ? 1 : -1)),
    counselingRecords: data.counselingRecords
      .filter((r) => r.studentId === studentId)
      .slice()
      .sort(byDateDesc),
    careerDesignResult:
      data.careerDesignResults.find((r) => r.studentId === studentId) ?? null,
    learningDiagnosisResult:
      data.learningDiagnosisResults.find((r) => r.studentId === studentId) ??
      null,
  }
}

// 학습기록 배열 → 과목별 학습시간 합계. 내림차순, 상위 limit개.
export function subjectBreakdown(learningRecords, limit = 8) {
  const bySubject = {}
  learningRecords.forEach((r) => {
    bySubject[r.subject] = (bySubject[r.subject] ?? 0) + (r.duration ?? 0)
  })
  return Object.entries(bySubject)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, minutes]) => ({ name, minutes }))
}
