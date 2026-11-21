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
import { defaultExamKey, sameExamKey } from '../../utils/examTerms.js'
import { CAREER_CATEGORY_LABELS } from '../../data/careerCategories.js'
import { STAGE_META, STAGE_ORDER } from '../../data/stageFeedbackLibrary.js'

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

// 기간을 달(月) 단위로 쪼갠 이용시간 합계. [{ label: '7월', minutes }]
// 여러 달 기간 리포트용 — 연도가 걸치면 라벨에 연도('26.12월')를 붙여 구분한다.
export function buildMonthlyUsage(attendanceRecords, startDate, endDate) {
  const [sy, sm] = startDate.split('-').map(Number)
  const [ey, em] = endDate.split('-').map(Number)
  const crossYear = sy !== ey
  const out = []
  let y = sy
  let m = sm
  while (y < ey || (y === ey && m <= em)) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    const minutes = attendanceRecords
      .filter((r) => inRange(r.date, startDate, endDate) && String(r.date).startsWith(ym))
      .reduce((sum, r) => sum + rowUsageMinutes(r), 0)
    out.push({ label: crossYear ? `${String(y).slice(2)}.${m}월` : `${m}월`, minutes })
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
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

// ── 요약 리포트(1쪽) 전용 빌더 ─────────────────────────────────────────

// 요약 리포트 카드별 권장 글자수 — PDF는 이 값 기준으로 폰트를 줄이고(최소 5pt),
// 모달은 같은 값을 카운터로 안내한다. 카드 크기를 바꾸면 함께 조정.
export const SUMMARY_TEXT_LIMITS = {
  coaching: 220, career: 170, diagnosis: 170, actionPlan: 330, subject: 190,
}

// 요약 리포트 하단 4교과 카드 (표시 순서 고정)
export const SUMMARY_SUBJECTS = ['수학', '영어', '과학', '국어']

// 강사 users.subject 문자열 → 4교과 키. 실데이터가 '수학' '영어' '과학' 단일값이지만
// 포함 여부로 판정하고, '비교과 계열심화 자연' 같은 비교과 담당은 제외(null).
export function summarySubjectKey(subject) {
  const s = String(subject ?? '')
  if (!s || s.includes('비교과') || s.includes('계열')) return null
  return SUMMARY_SUBJECTS.find((k) => s.includes(k)) ?? null
}

// 교과 컨설팅(subject_learning) 기록 → 4교과별 { count, autoText }.
// 자동 텍스트는 코칭과 같은 '날짜 · 내용' 형식.
export function buildSubjectCoachingSummary(records, educators) {
  const bucket = Object.fromEntries(SUMMARY_SUBJECTS.map((k) => [k, []]))
  for (const r of records) {
    if (r.type !== 'subject_learning') continue
    const key = summarySubjectKey(educators.find((e) => e.id === r.educatorId)?.subject)
    if (key) bucket[key].push(r)
  }
  return Object.fromEntries(SUMMARY_SUBJECTS.map((k) => [
    k, { count: bucket[k].length, autoText: buildTopicLines(bucket[k]) },
  ]))
}

// 상담 1건의 주제 — topic 필드 우선, 구 기록은 본문의 '[상담주제] …' 구간, 그것도 없으면 본문 앞부분.
export function counselingTopicOf(record) {
  const topic = (record.topic ?? '').trim()
  if (topic) return topic
  const body = (record.comment ?? '').trim()
  const tagged = body.match(/\[상담주제\]\s*([^[]+)/)
  const text = (tagged ? tagged[1] : body.split('\n')[0]).trim()
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

// 요약 리포트 교과 코칭 칸 — 클라이언트 요청(2026-11-21)으로 '날짜 · 상담 주제'만 한 줄씩 (날짜순).
export function buildTopicLines(records) {
  return records
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((r) => {
      const topic = counselingTopicOf(r)
      return topic ? `${fmtMD(r.date)} · ${topic}` : null
    })
    .filter(Boolean)
    .join('\n')
}

const EXAM_SLOTS = [
  { semester: 1, examType: 'mid', label: '1학기 중간' },
  { semester: 1, examType: 'final', label: '기말' },
  { semester: 2, examType: 'mid', label: '2학기 중간' },
  { semester: 2, examType: 'final', label: '기말' },
]

// 내신 피드백 → 기간 종료일이 속한 학년도의 4시험 성적 추이.
// score = 그 시험 과목 점수 평균(빈 점수 제외, 소수 첫째 자리), 기록 없으면 null(빈 슬롯).
// 그 시험 피드백이 없으면 바로 다음 시험 피드백의 '지난시험'(prevScore) 평균으로 채운다 —
// 학생들은 2학기 중간부터 기록을 시작해 1학기 기말 점수는 prevScore로만 들어 있다(2026-11 실데이터).
// actionPlan = 그 학년도에서 가장 나중 시험 피드백의 실천과제.
const avgOf = (subjects, field) => {
  const nums = (subjects ?? [])
    .map((s) => s[field])
    .filter((v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v)))
    .map(Number)
  if (nums.length === 0) return { score: null, count: 0 }
  return { score: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10, count: nums.length }
}

export function buildExamTrend(examFeedbacks, studentId, endDate) {
  const { examYear } = defaultExamKey(endDate)
  const mine = (examFeedbacks ?? []).filter((f) => f.studentId === studentId)
  const feedbackOf = (slot) => mine
    .filter((f) => sameExamKey(f, { examYear, semester: slot.semester, examType: slot.examType }))
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))[0] ?? null
  const fbs = EXAM_SLOTS.map(feedbackOf)
  let actionPlan = ''
  const bars = EXAM_SLOTS.map((slot, i) => {
    const fb = fbs[i]
    if (fb && (fb.actionPlan ?? '').trim()) actionPlan = fb.actionPlan.trim()
    const own = fb ? avgOf(fb.subjects, 'score') : { score: null, count: 0 }
    if (own.score != null) return { label: slot.label, score: own.score, subjectCount: own.count }
    const next = fbs[i + 1]
    const prev = next ? avgOf(next.subjects, 'prevScore') : { score: null, count: 0 }
    return { label: slot.label, score: prev.score, subjectCount: prev.count }
  })
  return { examYear, bars, actionPlan }
}

const latestUpTo = (rows, studentId, endDate) => (rows ?? [])
  .filter((r) => r.studentId === studentId && r.date && r.date <= endDate)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] ?? null

export const NO_TEST_TEXT = '검사 기록 없음'

// 진로 설계 검사 결과 → 요약 텍스트. 유형명 + 상위 3계열 + 추천 분야.
export function buildCareerSummaryText(careerResults, studentId, endDate) {
  const r = latestUpTo(careerResults, studentId, endDate)
  if (!r) return NO_TEST_TEXT
  const top = Object.entries(r.finalScores ?? {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => CAREER_CATEGORY_LABELS[k] ?? k)
  const fields = (r.fields ?? []).map((f) => f.field).filter(Boolean).slice(0, 3)
  const lines = [`유형: ${r.typeName || '-'} (검사일 ${r.date})`]
  if (top.length > 0) lines.push(`상위 계열: ${top.join(' > ')}`)
  if (fields.length > 0) lines.push(`추천 분야: ${fields.join(', ')}`)
  return lines.join('\n')
}

// 학습 진단 결과 → 요약 텍스트. 유형명 + 단계별 등급.
export function buildDiagnosisSummaryText(diagnosisResults, studentId, endDate) {
  const r = latestUpTo(diagnosisResults, studentId, endDate)
  if (!r) return NO_TEST_TEXT
  const grades = STAGE_ORDER
    .filter((s) => r.stageGrades?.[s])
    .map((s) => `${STAGE_META[s].label} ${r.stageGrades[s]}`)
  const lines = [`유형: ${r.typeName || '-'} (검사일 ${r.date})`]
  if (grades.length > 0) lines.push(`단계별 등급: ${grades.join(' · ')}`)
  return lines.join('\n')
}

// 요약 리포트 제목 기본값. 그룹명에 'N기'가 있으면 기간 연도와 조합('NAVI : 2026 4기'),
// 없으면 그룹명 그대로. (실데이터 그룹은 '안동NAVI' — data/groups.js)
export function defaultSummaryTitle(groups, year) {
  const list = groups ?? []
  const withTerm = list.map((g) => String(g).match(/(\d+)\s*기/)).find(Boolean)
  if (withTerm) return `NAVI : ${year} ${withTerm[1]}기`
  return list[0] ? `NAVI : ${list[0]}` : 'NAVI'
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
      monthly: buildMonthlyUsage(attendance, startDate, endDate),
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
    subjectCoaching: buildSubjectCoachingSummary(counseling, src.educators ?? []),
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
