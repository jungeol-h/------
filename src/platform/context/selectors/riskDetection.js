// [Read] 마인드 위험군 탐지 — data를 인자로 받는 순수함수.
//
// 위험 "탐지"는 레코드를 미리 만들지 않고 조회 시점에 계산한다 (관제탑형).
// 교육자가 화면을 열 때 마인드 점수 낮은 학생을 우선 파악하는 것이 목적이다.
// docs/통계.md "교육자 대시보드 = 위험군 탐지 관제탑" 과 일치.
//
// 위험에 대한 "조치(코칭) 기록"은 alerts 테이블이 담당한다 — 이 파일과 별개.

// 마인드 3항목으로 위험 등급 판정. 순수함수.
// docs/유저 개념/학습자/학생.md: 합산 -6 이하 또는 단일 -4 이하 → 위험.
// 반환: null(정상) | 'warning' | 'danger'
export function evaluateMindLevel({ mood, motivation, confidence }) {
  const total = mood + motivation + confidence
  const singleLow = mood <= -4 || motivation <= -4 || confidence <= -4
  const isCritical = total <= -6 || singleLow
  if (!isCritical) return null
  const isDanger = total <= -9 || singleLow
  return isDanger ? 'danger' : 'warning'
}

// 한 학생의 마인드 기록들 → 가장 최근 1건 기준 위험 등급.
// 기록이 없으면 null.
export function getMindStatus(mindRecords) {
  if (!mindRecords || mindRecords.length === 0) return null
  const latest = mindRecords
    .slice()
    .sort((a, b) => (b.date > a.date ? 1 : -1))[0]
  return evaluateMindLevel(latest)
}

const LEVEL_RANK = { danger: 0, warning: 1 }

// 위험군 학생 목록 — 마인드 위험 학생을 danger→warning 순 정렬.
// opts.educatorId 주면 그 교육자의 담당 학생만, 없으면(관리자) 전체 active 학생.
// 미배정 학생은 educatorId 필터엔 안 잡히지만 관리자 조회(필터 없음)엔 포함된다.
export function getRiskStudents(data, { educatorId } = {}) {
  let students = data.students.filter((s) => (s.status ?? 'active') === 'active')

  if (educatorId) {
    const myStudentIds = new Set(
      data.assignments
        .filter((a) => a.educatorId === educatorId)
        .map((a) => a.studentId)
    )
    students = students.filter((s) => myStudentIds.has(s.id))
  }

  return students
    .map((s) => {
      const records = data.mindRecords.filter((r) => r.studentId === s.id)
      return { student: s, level: getMindStatus(records) }
    })
    .filter((x) => x.level !== null)
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
}
