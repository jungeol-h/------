// [Read] 업무계획 조회 — data를 인자로 받는 순수함수

// 특정 날짜(YYYY-MM-DD)의 업무계획. 시간(HH:MM) 오름차순, 시간 미지정은 뒤로.
export function getWorkPlansForDate(data, dateStr) {
  return (data?.workPlans ?? [])
    .filter((p) => p.planDate === dateStr)
    .slice()
    .sort((a, b) => {
      if (!a.planTime && !b.planTime) return 0
      if (!a.planTime) return 1
      if (!b.planTime) return -1
      return a.planTime.localeCompare(b.planTime)
    })
}

// 학생별 업무계획 태그 횟수 — 학생 목록 '일정' 컬럼용. Map(studentId → count)
export function getStudentWorkPlanCounts(data) {
  const counts = new Map()
  ;(data?.workPlans ?? []).forEach((p) => {
    p.studentIds.forEach((sid) => {
      counts.set(sid, (counts.get(sid) ?? 0) + 1)
    })
  })
  return counts
}
