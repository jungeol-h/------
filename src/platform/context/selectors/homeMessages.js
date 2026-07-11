// [Read] 학생 홈 코멘트 말풍선 — data를 인자로 받는 순수함수.
//
// 관리자/강사가 남긴 것들을 학생 홈에 말풍선으로 노출한다 (최대 4건):
//  1) coach    : 최근 14일 상담기록 중 후속조치(followUp)가 있는 최신 1건
//  2) task     : 마감이 오늘/내일인 미완료 과제 최대 2건
//  3) schedule : 오늘/내일 업무계획에 본인이 태그된 일정
// 학생 fetch는 상담기록을 제한 컬럼(follow_up 등)만 받으므로 본문 노출 없음.

import { toDateStr } from '../../utils/dateUtils.js'
import { COUNSELING_TYPE_LABELS } from '../../data/counselingTypes.js'

const COACH_WINDOW_DAYS = 14
const MAX_MESSAGES = 4

export function getStudentHomeMessages(data, studentId, today = new Date()) {
  const todayStr = toDateStr(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = toDateStr(tomorrow)
  const since = new Date(today)
  since.setDate(since.getDate() - COACH_WINDOW_DAYS)
  const sinceStr = toDateStr(since)

  const messages = []

  // 1) 코칭 후속조치 — 최신 1건
  const coach = (data?.counselingRecords ?? [])
    .filter((r) => r.studentId === studentId && r.followUp?.trim() && String(r.date) >= sinceStr)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
  if (coach) {
    messages.push({
      id: `coach-${coach.id}`,
      kind: 'coach',
      title: '선생님 한마디',
      text: coach.followUp.trim(),
      date: coach.date,
    })
  }

  // 2) 과제 리마인더 — 마감 오늘/내일, 최대 2건
  ;(data?.tasks ?? [])
    .filter(
      (t) =>
        t.studentId === studentId &&
        t.status !== 'done' &&
        (t.dueDate === todayStr || t.dueDate === tomorrowStr)
    )
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
    .slice(0, 2)
    .forEach((t) => {
      messages.push({
        id: `task-${t.id}`,
        kind: 'task',
        title: '과제 리마인더',
        text: `『${t.title}』 ${t.dueDate === todayStr ? '오늘' : '내일'} 마감이에요.`,
        date: t.dueDate,
      })
    })

  // 3) 일정 리마인더 — 오늘/내일 업무계획에 본인 태그
  ;(data?.workPlans ?? [])
    .filter(
      (p) =>
        p.studentIds.includes(studentId) &&
        (p.planDate === todayStr || p.planDate === tomorrowStr)
    )
    .sort((a, b) => String(a.planDate).localeCompare(String(b.planDate)))
    .forEach((p) => {
      const typeLabel = p.types.map((t) => COUNSELING_TYPE_LABELS[t] ?? t).join('·')
      const when = p.planDate === todayStr ? '오늘' : '내일'
      const time = p.planTime ? ` ${p.planTime}에` : ''
      messages.push({
        id: `schedule-${p.id}`,
        kind: 'schedule',
        title: '일정 안내',
        text: `${when}${time} ${typeLabel || '상담'} 일정이 있어요.`,
        date: p.planDate,
      })
    })

  return messages.slice(0, MAX_MESSAGES)
}
