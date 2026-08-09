// [Read] 종합성장리포트(월간) 데이터 조립 — 기간 인자를 받는 순수함수.
// 2026-08 클라이언트 개편: 월 단위 기간 선택 + ①센터 총 이용시간 ②과목별/
// 학습법별 학습시간 ③교과 컨설팅 받은 시간(교과별) ④자기주도학습코칭 내용
// (자동 생성 + 수동 편집) ⑤피드백 ⑥확인평가 ⑦과제 내역으로 구성한다.
//
// 컬렉션은 호출부(components/reports/GrowthReportModal)가 해당 학생·기간을
// supabase에서 직접 조회해 넘긴다 — 역할별 fetch 윈도(출결 60일 등)에
// 얽매이지 않기 위함 (MonthlyOperationsReportModal과 같은 이유·패턴).

import {
  actualMinutes, timeTrackedRecords, subjectBreakdown, methodBreakdown,
} from './learningRecords.js'
import { getSelfDirectedIndex, getEmotionStability } from './indices.js'
import { rowUsageMinutes } from './monthlyOperationsReport.js'
import { timeToMinutes } from './attendance.js'
import { toDateStr } from '../../utils/dateUtils.js'

// 상담 시간 미기재 구 기록의 기본 시간(분) — 교과 컨설팅 60분 시수 규칙
// (monthlyOperationsReport의 교과60 스냅 규칙과 같은 근거).
export const DEFAULT_CONSULT_MINUTES = 60

const inRange = (dateStr, startDate, endDate) =>
  !!dateStr && dateStr >= startDate && dateStr <= endDate

// timestamptz(ISO) → KST 기준 'YYYY-MM-DD'. (UTC slice 금지 — dateUtils 규칙)
const kstDateOf = (ts) => {
  if (!ts) return null
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? null : toDateStr(d)
}

const fmtMD = (dateStr) => {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-').map(Number)
  return `${m}/${d}`
}

// 기간을 시작일부터 7일 단위 주차로 쪼갠 이용시간 합계. [{ label: 'M/D~M/D', minutes }]
export function buildWeeklyUsage(attendanceRecords, startDate, endDate) {
  const weeks = []
  const [y, m, d] = startDate.split('-').map(Number)
  let cursor = new Date(y, m - 1, d)
  while (toDateStr(cursor) <= endDate) {
    const weekStart = toDateStr(cursor)
    const weekEndDate = new Date(cursor)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    const weekEnd = toDateStr(weekEndDate) <= endDate ? toDateStr(weekEndDate) : endDate
    const minutes = attendanceRecords
      .filter((r) => inRange(r.date, weekStart, weekEnd))
      .reduce((sum, r) => sum + rowUsageMinutes(r), 0)
    weeks.push({ label: `${fmtMD(weekStart)}~${fmtMD(weekEnd)}`, minutes })
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

// 상담 1건의 시간(분). start/end('HH:MM')가 유효하면 그 간격, 아니면 기본 60분.
export function consultMinutes(record) {
  const s = timeToMinutes(record.startTime)
  const e = timeToMinutes(record.endTime)
  if (s != null && e != null && e > s) return e - s
  return DEFAULT_CONSULT_MINUTES
}

// 교과 컨설팅(type='subject_learning')을 담당 강사의 교과(users.subject)별로 집계.
// 강사 미상·교과 미지정은 '기타'.
export function buildConsultingBySubject(records, educators) {
  const bySubject = new Map()
  for (const r of records) {
    const educator = educators.find((e) => e.id === r.educatorId)
    const name = educator?.subject || '기타'
    const cur = bySubject.get(name) ?? { name, sessions: 0, minutes: 0 }
    cur.sessions += 1
    cur.minutes += consultMinutes(r)
    bySubject.set(name, cur)
  }
  const rows = [...bySubject.values()].sort((a, b) => b.minutes - a.minutes)
  return {
    rows,
    totalSessions: rows.reduce((s, r) => s + r.sessions, 0),
    totalMinutes: rows.reduce((s, r) => s + r.minutes, 0),
  }
}

// 자기주도학습코칭(type='self_directed') 기록 → 자동 생성 텍스트 (날짜순).
// 신 기록은 comment(6단계 합성 텍스트), 구 기록·예약 기록은 구조화 필드로 조립.
export function buildCoachingAutoText(records) {
  return records
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((r) => {
      const body = (r.comment || [r.topic, r.diagnosis, r.advice].filter(Boolean).join(' / ')).trim()
      return body ? `${fmtMD(r.date)} · ${body}` : null
    })
    .filter(Boolean)
    .join('\n')
}

// 리포트 데이터 조립 본체. src 컬렉션은 모두 해당 학생 것만 넘겨도 되고,
// 섞여 있어도 studentId로 다시 거른다.
export function buildGrowthReportData(src, { studentId, startDate, endDate }) {
  const byStudent = (r) => r.studentId === studentId

  const attendance = (src.attendanceRecords ?? [])
    .filter((r) => byStudent(r) && inRange(r.date, startDate, endDate))
  const learning = timeTrackedRecords(src.learningRecords ?? [])
    .filter((r) => byStudent(r) && inRange(r.date, startDate, endDate))
  const counseling = (src.counselingRecords ?? [])
    .filter((r) => byStudent(r) && inRange(r.date, startDate, endDate))
  const mind = (src.mindRecords ?? [])
    .filter((r) => byStudent(r) && inRange(r.date, startDate, endDate))
  const feedbacks = (src.studentFeedbacks ?? [])
    .filter((r) => byStudent(r) && inRange(r.date, startDate, endDate))
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const tasks = (src.tasks ?? [])
    .filter((t) => byStudent(t) && inRange(t.dueDate, startDate, endDate))
    .slice()
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))

  // 센터 이용시간 (등하원 이벤트 쌍 합산)
  const usageMinutes = attendance.reduce((sum, r) => sum + rowUsageMinutes(r), 0)

  // 학습 (타이머·플래너 실측 시간)
  const studyMinutes = learning.reduce((sum, r) => sum + actualMinutes(r), 0)
  const selfIndex = getSelfDirectedIndex({ learningRecords: learning }, studentId)

  // 교과 컨설팅 / 자기주도학습코칭
  const consulting = buildConsultingBySubject(
    counseling.filter((r) => r.type === 'subject_learning'),
    src.educators ?? []
  )
  const coachingRecords = counseling.filter((r) => r.type === 'self_directed')

  // 확인평가 (응시일 KST 기준으로 기간 필터)
  const sets = src.quizSets ?? []
  const quizRows = (src.quizAttempts ?? [])
    .filter((a) => byStudent(a) && inRange(kstDateOf(a.submittedAt), startDate, endDate))
    .slice()
    .sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))
    .map((a) => {
      const set = sets.find((s) => s.id === a.quizSetId)
      const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : null
      return {
        id: a.id,
        label: set ? `${set.subject} ${set.round}회` : '-',
        title: set?.title ?? '-',
        score: a.score ?? 0,
        total: a.total ?? 0,
        pct,
        submittedAt: kstDateOf(a.submittedAt) ?? '-',
      }
    })
  const scored = quizRows.filter((r) => r.pct != null)
  const avgPct = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + r.pct, 0) / scored.length)
    : null

  const done = tasks.filter((t) => t.status === 'done').length

  return {
    usage: {
      totalMinutes: usageMinutes,
      weekly: buildWeeklyUsage(attendance, startDate, endDate),
    },
    study: {
      totalMinutes: studyMinutes,
      selfIndex,
      subjectDist: subjectBreakdown(learning),
      methodDist: methodBreakdown(learning),
    },
    mind: {
      stability: getEmotionStability({ mindRecords: mind }, studentId),
      count: mind.length,
    },
    consulting,
    coaching: {
      count: coachingRecords.length,
      autoText: buildCoachingAutoText(coachingRecords),
    },
    feedbacks: feedbacks.map((f) => ({
      id: f.id, date: f.date, authorName: f.authorName, content: f.content,
    })),
    quiz: { rows: quizRows, avgPct },
    tasks: {
      total: tasks.length,
      done,
      rate: tasks.length > 0 ? done / tasks.length : null,
      rows: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        subject: t.subject ?? '',
        dueDate: t.dueDate ?? '',
        status: t.status ?? 'pending',
      })),
    },
  }
}
