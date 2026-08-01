// 학생별 컨설팅 리포트(pdf/reports/StudentCounselingReport)용 데이터 조립.
// 재원생/외생 공용 — 호출부가 한 학생의 records를 {id, date, startTime?, endTime?,
// topic…note, fallbackContent, educatorName, typeLabel}로 정규화해서 넘긴다.
// '등록일정'은 attendance_schedules를 시간블록 기호(M1, SA3 …)로 변환해 표시한다.
import { hasStructuredContent } from '../../data/counselingTypes.js'
import { ATTENDANCE_BLOCKS } from '../../data/attendanceBlocks.js'
import { timeToMinutes, dayLabel } from './attendance.js'
import { formatKoreanDate, formatCompactDateTime } from './monthlyCounselingReport.js'

// 하루의 등원~하원 구간을 블록으로 그리디 타일링 — 겹침(staggered) 블록 중
// 시작시각이 진행 지점과 맞는 것만 차례로 채운다. 예: 월 16:00~20:50 → [M1, M3].
// 허용 오차: 시작 -30분(조금 늦게 시작한 블록도 인정), 종료 +10분.
export function blockCodesFor(dayOfWeek, arrivalTime, departureTime) {
  const blocks = ATTENDANCE_BLOCKS[dayOfWeek] ?? []
  const arrival = timeToMinutes(arrivalTime)
  const departure = timeToMinutes(departureTime)
  if (arrival == null || departure == null || blocks.length === 0) return []

  const codes = []
  let cursor = arrival
  for (const b of blocks) {
    const start = timeToMinutes(b.start)
    const end = timeToMinutes(b.end)
    if (start > departure) break // 이후 블록은 전부 창 밖 (start 오름차순 전제)
    if (start < cursor - 30) continue // 이미 채운 구간과 겹치는 staggered 블록
    if (end > departure + 10) continue // 하원 시각을 넘는 블록
    codes.push(b.code)
    cursor = end
  }
  return codes
}

// attendance_schedules 배열 → '등록일정' 표시 문자열.
// 요일은 월~일 순. 블록 매칭이 안 되는 요일(수·목, 비정형 시간)은 원문 폴백.
// 예: 'M1 M3 · T2 · 수 16:00~18:00 · SA1'
export function formatScheduleBlocks(schedules) {
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // 월~토, 일
  return DAY_ORDER.map((dow) => {
    const s = (schedules ?? []).find((x) => x.dayOfWeek === dow)
    if (!s || !s.arrivalTime || !s.departureTime) return null
    const codes = blockCodesFor(dow, s.arrivalTime, s.departureTime)
    if (codes.length > 0) return codes.join(' ')
    return `${dayLabel(dow)} ${s.arrivalTime}~${s.departureTime}`
  })
    .filter(Boolean)
    .join(' · ')
}

function byDateTime(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const at = a.startTime || ''
  const bt = b.startTime || ''
  if (at !== bt) return at < bt ? -1 : 1
  return String(a.id) < String(b.id) ? -1 : 1
}

// 한 학생의 전체 상담 이력 → 리포트 항목 + 조회기간.
// 누적횟수(N회차)는 학생 기준 통산 순번(작성 강사 무관).
// 반환: { entries, totalCount, periodText }
export function buildStudentCounselingEntries(records) {
  const entries = (records ?? [])
    .slice()
    .sort(byDateTime)
    .map((r, i) => {
      const structured = hasStructuredContent(r)
      return {
        no: i + 1,
        educatorName: r.educatorName || '-',
        typeLabel: r.typeLabel || '-',
        dateTimeText: formatCompactDateTime(r.date, r.startTime, r.endTime),
        cumulativeText: `${i + 1}회차`,
        topic: structured ? r.topic : '',
        diagnosis: structured ? r.diagnosis : '',
        advice: structured ? r.advice : '',
        followUp: structured ? r.followUp : '',
        fallbackContent: structured ? '' : (r.fallbackContent ?? ''),
        note: r.note ?? '',
      }
    })

  const dates = (records ?? []).map((r) => r.date).filter(Boolean).sort()
  const firstDate = dates[0]
  const lastDate = dates[dates.length - 1]
  const periodText = firstDate
    ? firstDate === lastDate
      ? formatKoreanDate(firstDate)
      : `${formatKoreanDate(firstDate)} ~ ${formatKoreanDate(lastDate)}`
    : '-'

  return { entries, totalCount: entries.length, periodText }
}
