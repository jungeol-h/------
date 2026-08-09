// 월간 종합 보고서(pdf/reports/MonthlyOperationsReport)용 집계 — 2026-08 클라 확정 규칙.
//
// 시수 기준 (분 ÷ 기준분, 소수 1자리):
//   진로진학 컨설팅 40분 = 1시수 · 교과·기타 컨설팅 60분(20분×3) = 1시수 · 교과 수업 60분 = 1시수
// 세션 시간 스냅: 50~70분은 60분으로 계산(클라: "50이상~60미만, 60초과~70이하 모두 60분").
// 시간 미입력 세션(구 기록 다수)은 최소 단위로 간주 — 교과 컨설팅 20분(1회),
// 진로진학 40분(1시수), 수업 60분(1시수). 클라가 별도 규칙을 주지 않아 정한 기본값.
// 클라의 "일일 누적 시간 ÷ 60" 규칙은 일 단위 반올림이 없어 월 합산 ÷ 기준분과 동치.
//
// 그룹 상담 fan-out(학생별 개별 행)은 sessionKey로 병합해 근무시간에 1회만 센다.
import { educatorDisplayName } from '../../utils/educatorName.js'
import { durationMinutes, sessionKey } from './monthlyCounselingReport.js'

// 진로진학 컨설팅으로 집계하는 상담유형 (구 체계 '진로' 포함)
export const CAREER_COUNSELING_TYPES = ['career_path', 'career']

export const COUNSELING_CATEGORIES = {
  career: { label: '진로진학 컨설팅', unitMinutes: 40, fallbackMinutes: 40 },
  subject: { label: '교과·기타 컨설팅', unitMinutes: 60, fallbackMinutes: 20 },
}

export const LESSON_CATEGORY = { label: '교과 수업', unitMinutes: 60, fallbackMinutes: 60 }

// 50~70분 → 60분 스냅. 그 외 구간은 실측 분 그대로.
export function snapMinutes(minutes) {
  return minutes >= 50 && minutes <= 70 ? 60 : minutes
}

// 세션 1건의 집계 분 — 시간 미입력·역전은 fallback(최소 단위).
export function sessionMinutesOf(startTime, endTime, fallbackMinutes) {
  const d = durationMinutes(startTime, endTime)
  return d == null ? fallbackMinutes : snapMinutes(d)
}

// 분 → '12시간 40분' (시 없으면 '40분', 0분이면 '0분')
export function minutesToText(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

const hoursOf = (minutes, unitMinutes) => Math.round((minutes / unitMinutes) * 10) / 10

const byNameKo = (a, b) => (a.name || '').localeCompare(b.name || '', 'ko')

function educatorNameMap(educators) {
  return new Map((educators ?? []).map((e) => [e.id, educatorDisplayName(e) ?? e.id]))
}

// 강사별 컨설팅 집계 — records: 해당 월 무관 전량을 넘겨도 되지만 month로 거른다.
// 반환 rows: [{ name, category, sessions, minutes, minutesText, hours }] (강사 이름순,
// 강사 내 교과 → 진로진학 순) + totals { sessions, minutes, minutesText, hours }.
export function buildMonthlyCounselingStats(records, educators, month) {
  const names = educatorNameMap(educators)
  const inMonth = (records ?? []).filter((r) => r.date?.startsWith(month) && r.educatorId)

  // fan-out 병합: 강사 + 세션 서명 단위로 1회
  const seen = new Set()
  const acc = new Map() // educatorId → { career: {sessions,minutes}, subject: {...} }
  for (const r of inMonth) {
    const key = `${r.educatorId}|${sessionKey(r)}`
    if (seen.has(key)) continue
    seen.add(key)
    const catKey = CAREER_COUNSELING_TYPES.includes(r.type) ? 'career' : 'subject'
    const cat = COUNSELING_CATEGORIES[catKey]
    const minutes = sessionMinutesOf(r.startTime, r.endTime, cat.fallbackMinutes)
    if (!acc.has(r.educatorId)) {
      acc.set(r.educatorId, {
        career: { sessions: 0, minutes: 0 },
        subject: { sessions: 0, minutes: 0 },
      })
    }
    const slot = acc.get(r.educatorId)[catKey]
    slot.sessions += 1
    slot.minutes += minutes
  }

  const rows = []
  const totals = { sessions: 0, minutes: 0, hours: 0 }
  const educatorRows = [...acc.entries()]
    .map(([id, cats]) => ({ id, name: names.get(id) ?? id, cats }))
    .sort(byNameKo)
  for (const { name, cats } of educatorRows) {
    for (const catKey of ['subject', 'career']) {
      const { sessions, minutes } = cats[catKey]
      if (sessions === 0) continue
      const cat = COUNSELING_CATEGORIES[catKey]
      const hours = hoursOf(minutes, cat.unitMinutes)
      rows.push({
        name,
        category: cat.label,
        sessions,
        minutes,
        minutesText: minutesToText(minutes),
        hours,
      })
      totals.sessions += sessions
      totals.minutes += minutes
      totals.hours = Math.round((totals.hours + hours) * 10) / 10
    }
  }
  return { rows, totals: { ...totals, minutesText: minutesToText(totals.minutes) } }
}

// 강사별 수업 집계 — lesson_reports는 fan-out이 없어 병합 불필요(1행 = 1수업).
export function buildMonthlyLessonStats(reports, educators, month) {
  const names = educatorNameMap(educators)
  const acc = new Map() // authorId → { sessions, minutes }
  for (const r of reports ?? []) {
    if (!r.date?.startsWith(month) || !r.authorId) continue
    const minutes = sessionMinutesOf(r.startTime, r.endTime, LESSON_CATEGORY.fallbackMinutes)
    if (!acc.has(r.authorId)) acc.set(r.authorId, { sessions: 0, minutes: 0 })
    const slot = acc.get(r.authorId)
    slot.sessions += 1
    slot.minutes += minutes
  }

  const totals = { sessions: 0, minutes: 0, hours: 0 }
  const rows = [...acc.entries()]
    .map(([id, { sessions, minutes }]) => ({
      name: names.get(id) ?? id,
      sessions,
      minutes,
      minutesText: minutesToText(minutes),
      hours: hoursOf(minutes, LESSON_CATEGORY.unitMinutes),
    }))
    .sort(byNameKo)
  for (const row of rows) {
    totals.sessions += row.sessions
    totals.minutes += row.minutes
    totals.hours = Math.round((totals.hours + row.hours) * 10) / 10
  }
  return { rows, totals: { ...totals, minutesText: minutesToText(totals.minutes) } }
}

// 학생 이용 현황 — rows: [{ status, checkInAt, checkOutAt, events }] (해당 월 전량).
// 누적 출석 인원 = present+late 연인원 (지각도 등원이므로 출석에 포함 — 앱 공통 규약).
// 이용시간 = events의 in→out 쌍 합(재등원 반영), events 없는 구 기록은 입실~퇴실 간격.
export function buildAttendanceUsage(rows) {
  let presentCount = 0
  let usageMinutes = 0
  for (const r of rows ?? []) {
    if (r.status === 'present' || r.status === 'late') presentCount += 1
    usageMinutes += rowUsageMinutes(r)
  }
  return { presentCount, usageMinutes, usageText: minutesToText(usageMinutes) }
}

// 출결 1행의 이용시간(분) — growthReport(학생별 종합성장리포트)도 재사용한다.
export function rowUsageMinutes(r) {
  const events = Array.isArray(r.events) ? r.events : []
  const pairs = []
  let pendingIn = null
  for (const ev of events) {
    if (ev?.type === 'in' && ev.at) pendingIn = ev.at
    else if (ev?.type === 'out' && ev.at && pendingIn) {
      pairs.push([pendingIn, ev.at])
      pendingIn = null
    }
  }
  // 마지막 입실이 미퇴실이면 최종 퇴실 시각으로 보정
  if (pendingIn && r.checkOutAt) pairs.push([pendingIn, r.checkOutAt])
  if (pairs.length === 0 && r.checkInAt && r.checkOutAt) pairs.push([r.checkInAt, r.checkOutAt])

  let total = 0
  for (const [inAt, outAt] of pairs) {
    const diff = (new Date(outAt) - new Date(inAt)) / 60000
    if (Number.isFinite(diff) && diff > 0) total += Math.round(diff)
  }
  return total
}
