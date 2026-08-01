// 강사별 월간 컨설팅 보고서(pdf/reports/MonthlyCounselingReport)용 데이터 조립.
// 재원생 상담(counseling_records)과 외부상담(program_counseling_records) 공용 —
// 호출부가 { educatorId, date, startTime?, endTime?, topic…note, fallbackContent }로
// 정규화해서 넘긴다 (외부상담은 시간 필드가 없어 startTime/endTime이 빈 문자열).
import { toDateStr } from '../../utils/dateUtils.js'
import { hasStructuredContent } from '../../data/counselingTypes.js'

const DOW_KR = ['일', '월', '화', '수', '목', '금', '토']

// 'YYYY-MM-DD' → '2026. 7. 5.(토)' — 보고서 양식의 날짜 표기.
export function formatKoreanDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dow = DOW_KR[new Date(y, m - 1, d).getDay()]
  return `${y}. ${m}. ${d}.(${dow})`
}

// 'HH:MM' → 'pm 2:00' (양식 표기). 0시→am 12, 12시→pm 12.
export function formatAmPm(hhmm) {
  const [h, m] = String(hhmm ?? '').split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return ''
  const meridiem = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${meridiem} ${h12}:${String(m).padStart(2, '0')}`
}

// 시작~종료 분 차이. 파싱 실패·0 이하이면 null.
export function durationMinutes(startTime, endTime) {
  const parse = (t) => {
    const [h, m] = String(t ?? '').split(':').map(Number)
    return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null
  }
  const s = parse(startTime)
  const e = parse(endTime)
  if (s == null || e == null || e <= s) return null
  return e - s
}

// date + start/end → '2026. 7. 5.(토) pm 2:00 ~ pm 2:20 (20분)'
// 시간이 없으면 날짜만, 시작만 있으면 종료·소요분 생략.
export function formatCounselingDateTime(date, startTime, endTime) {
  const dateText = formatKoreanDate(date)
  const start = formatAmPm(startTime)
  if (!start) return dateText
  const end = formatAmPm(endTime)
  if (!end) return `${dateText} ${start}`
  const mins = durationMinutes(startTime, endTime)
  return `${dateText} ${start} ~ ${end}${mins ? ` (${mins}분)` : ''}`
}

// 이번 달 1일~말일 ['YYYY-MM-01', 'YYYY-MM-말일'] — 출력 모달 기본 기간.
export function currentMonthRange(today = new Date()) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return [toDateStr(first), toDateStr(last)]
}

// 'YYYY-MM-DD'가 속한 달의 1일~말일. 파싱 실패 시 null.
// 월초에 출력 모달을 열면 기본 기간(이번 달)이 0건이라 — 최근 기록이 있는
// 달로 기간을 자동 이동할 때 쓴다 (2026-08-01 "출력할 기록이 없습니다" 사고).
export function monthRangeOf(dateStr) {
  const [y, m] = String(dateStr ?? '').split('-').map(Number)
  if (!y || !m) return null
  return [toDateStr(new Date(y, m - 1, 1)), toDateStr(new Date(y, m, 0))]
}

// (date, startTime, id) 오름차순 — 회차 부여와 출력 순서에 공통 사용.
export function byDateTime(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const at = a.startTime || ''
  const bt = b.startTime || ''
  if (at !== bt) return at < bt ? -1 : 1
  return String(a.id) < String(b.id) ? -1 : 1
}

// 강사 1명의 기간 내 보고서 항목 조립.
// records: 강사 무관 **전체 이력** — 누적횟수(N회차)가 조회기간 이전을 포함해
//          학생×강사 기준으로 세어지므로 기간으로 미리 자르면 안 된다.
// getStudent: (studentId) => { name, school, grade } | undefined
// 반환: { entries, totalCount } — entries는 MonthlyCounselingReport props 형태.
export function buildMonthlyCounselingEntries(records, getStudent, { educatorId, startDate, endDate }) {
  const mine = (records ?? []).filter((r) => r.educatorId === educatorId)

  // 학생별 전체 이력 오름차순 → recordId → 누적 회차
  const roundOf = new Map()
  const byStudent = new Map()
  for (const r of mine) {
    if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, [])
    byStudent.get(r.studentId).push(r)
  }
  for (const list of byStudent.values()) {
    list.sort(byDateTime)
    list.forEach((r, i) => roundOf.set(r.id, i + 1))
  }

  const entries = mine
    .filter((r) => r.date && r.date >= startDate && r.date <= endDate)
    .sort(byDateTime)
    .map((r, i) => {
      const student = getStudent(r.studentId) ?? {}
      const structured = hasStructuredContent(r)
      return {
        no: i + 1,
        studentName: student.name || '-',
        schoolGrade: [student.school, student.grade].filter(Boolean).join(' '),
        dateTimeText: formatCounselingDateTime(r.date, r.startTime, r.endTime),
        cumulativeText: `${roundOf.get(r.id)}회차`,
        topic: structured ? r.topic : '',
        diagnosis: structured ? r.diagnosis : '',
        advice: structured ? r.advice : '',
        followUp: structured ? r.followUp : '',
        fallbackContent: structured ? '' : (r.fallbackContent ?? ''),
        note: r.note ?? '',
      }
    })

  return { entries, totalCount: entries.length }
}
