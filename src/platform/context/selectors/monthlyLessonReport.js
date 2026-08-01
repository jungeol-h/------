// 강사별 월간 수업보고서(pdf/reports/MonthlyLessonReport)용 데이터 조립.
// monthlyCounselingReport.js와 같은 구조 — 수업보고(lesson_reports)는 학생이
// 복수(studentIds)이고 교재·과제 필드가 있어 별도 선택자로 둔다.
import { byDateTime, formatCounselingDateTime } from './monthlyCounselingReport.js'

// 강사 1명의 기간 내 수업보고 항목 조립.
// reports: 강사 무관 **전체 이력**(data.lessonReports) — 누적횟수(N회차)가
//          조회기간 이전을 포함해 강사 기준으로 세어지므로 기간으로 미리 자르면 안 된다.
// getStudent: (studentId) => { name } | undefined
// 반환: { entries, totalCount } — entries는 MonthlyLessonReport props 형태.
export function buildMonthlyLessonEntries(reports, getStudent, { educatorId, startDate, endDate }) {
  const mine = (reports ?? []).filter((r) => r.authorId === educatorId)

  // 강사 전체 이력 오름차순 → recordId → 누적 회차 (수업 시수 누적)
  const sorted = mine.slice().sort(byDateTime)
  const roundOf = new Map(sorted.map((r, i) => [r.id, i + 1]))

  const entries = mine
    .filter((r) => r.date && r.date >= startDate && r.date <= endDate)
    .sort(byDateTime)
    .map((r, i) => {
      const ids = r.studentIds ?? []
      return {
        no: i + 1,
        studentNames: ids.map((sid) => getStudent(sid)?.name || '-').join(', '),
        studentCountText: `${ids.length}명`,
        dateTimeText: formatCounselingDateTime(r.date, r.startTime, r.endTime),
        cumulativeText: `${roundOf.get(r.id)}회차`,
        topic: r.topic ?? '',
        textbook: r.textbook ?? '',
        content: r.content ?? '',
        homework: r.homework ?? '',
        note: r.note ?? '',
      }
    })

  return { entries, totalCount: entries.length }
}
