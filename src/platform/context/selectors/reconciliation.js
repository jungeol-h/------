// [Read] 시스템 정합성 점검 — data를 인자로 받는 순수함수.
//
// 목적: "학생이 데이터를 추가했는데 구조적 결함으로 매니저/관리자 화면에
// 안 나타나는 침묵 실패"를 관리자가 스스로 발견하게 한다. 시스템이 불일치를
// 찾아 대시보드에 노출하는 것만이 "아무도 모름"을 깬다.
//
// 탐지 항목:
//  - unassignedActive : status=active 인데 educator 배정이 0건인 학생
//    (fetchForManager는 배정된 학생만 fetch하므로, 미배정 학생의 활동은
//     어느 매니저 화면에도 안 나타난다)
//  - orphanAssignments : student_id 또는 educator_id 가 users에 없는 배정 row
//  - truncatedTables : fetch limit에 걸려 일부만 불러온 테이블 (_fetchMeta 기반)
//  - fetchErrors : 로드 자체가 실패한 쿼리 (_fetchErrors 기반)

export function getReconciliationIssues(data) {
  const students = data.students ?? []
  const educators = data.educators ?? []
  const assignments = data.assignments ?? []

  const activeStudents = students.filter(
    (s) => (s.status ?? 'active') === 'active'
  )

  // 미배정 활성 학생
  const assignedStudentIds = new Set(assignments.map((a) => a.studentId))
  const unassignedActive = activeStudents.filter(
    (s) => !assignedStudentIds.has(s.id)
  )

  // orphan 배정 — 가리키는 학생/교육자가 users에 없음
  const studentIdSet = new Set(students.map((s) => s.id))
  const educatorIdSet = new Set(educators.map((e) => e.id))
  const orphanAssignments = assignments.filter(
    (a) => !studentIdSet.has(a.studentId) || !educatorIdSet.has(a.educatorId)
  )

  // limit 잘림 — fetched < total
  const meta = data._fetchMeta ?? {}
  const truncatedTables = Object.entries(meta)
    .filter(([, m]) => m && typeof m.total === 'number' && m.fetched < m.total)
    .map(([table, m]) => ({ table, fetched: m.fetched, total: m.total }))

  const fetchErrors = data._fetchErrors ?? []

  const hasIssue =
    unassignedActive.length > 0 ||
    orphanAssignments.length > 0 ||
    truncatedTables.length > 0 ||
    fetchErrors.length > 0

  return {
    unassignedActive,
    orphanAssignments,
    truncatedTables,
    fetchErrors,
    hasIssue,
  }
}
