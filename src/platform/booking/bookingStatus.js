// 예약 시스템 상태값 상수·라벨·파생 판정.
//
// 저장하는 상태는 최소화하고(슬롯 status, 예약 status, 출결 status, 기록 draft/done)
// 나머지 — 정원 마감, 운영 종료, 상담대기/출결미처리, 기록 기한임박/초과/작성대상아님 —
// 는 전부 여기서 파생한다. 저장된 파생값은 드리프트만 만든다.

import { toDateStr } from '../utils/dateUtils.js'
import { addDaysStr, todayStrKst } from './bookingRules.js'

// ─── 슬롯 상태 (명세 5.4) ─────────────────────────────────────
export const SLOT_STATUS = {
  draft: { label: '작성중', color: 'bg-gray-100 text-gray-600' },
  reviewed: { label: '검토완료', color: 'bg-yellow-100 text-yellow-700' },
  open: { label: '예약공개', color: 'bg-green-100 text-green-700' },
  closed: { label: '예약마감', color: 'bg-orange-100 text-orange-700' },
  done: { label: '운영종료', color: 'bg-gray-100 text-gray-500' },
  cancelled: { label: '운영취소', color: 'bg-red-100 text-red-600' },
}

// ─── 출결 상태 (명세 13.1) ────────────────────────────────────
export const ATTENDANCE_STATUS = {
  pending: { label: '미처리', color: 'bg-gray-100 text-gray-600' },
  attended: { label: '참석', color: 'bg-green-100 text-green-700' },
  absent: { label: '미참석', color: 'bg-red-100 text-red-600' },
  student_cancel: { label: '학생 사전취소', color: 'bg-orange-100 text-orange-700' },
  educator_cancel: { label: '강사 사유 취소', color: 'bg-orange-100 text-orange-700' },
  center_cancel: { label: '센터 사유 취소', color: 'bg-orange-100 text-orange-700' },
  rescheduled: { label: '일정 변경', color: 'bg-blue-100 text-blue-700' },
}

// 강사 출결 처리 버튼에 노출하는 순서
export const ATTENDANCE_CHOICES = [
  'attended', 'absent', 'student_cancel', 'educator_cancel', 'center_cancel', 'rescheduled',
]

// ─── 예약 표시 상태 (명세 12) — 저장값 + 시각으로 파생 ─────────
// reservation: { status, attendanceStatus, cancelledByRole }, slot: { date, startTime }
export function reservationDisplayStatus(reservation, slot, now = new Date()) {
  if (reservation.status === 'moved') return { key: 'moved', label: '변경완료' }
  if (reservation.status === 'cancelled') {
    const role = reservation.cancelledByRole
    if (role === 'student' || role === 'parent') return { key: 'user_cancel', label: '사용자취소' }
    if (role === 'admin') return { key: 'admin_cancel', label: '관리자취소' }
    return { key: 'educator_cancel', label: '강사취소' }
  }
  // confirmed
  const att = reservation.attendanceStatus
  if (att === 'attended') return { key: 'attended', label: '참석' }
  if (att === 'absent') return { key: 'absent', label: '미참석' }
  if (att === 'center_cancel' || att === 'educator_cancel') {
    return { key: 'ops_cancel', label: '운영취소' }
  }
  if (att === 'rescheduled') return { key: 'moved', label: '변경완료' }
  if (att === 'student_cancel') return { key: 'user_cancel', label: '사용자취소' }
  // pending — 시작 전이면 상담대기, 지났으면 출결미처리 (자동 참석 처리는 없다 — 명세 13.3)
  if (slot && isSlotPast(slot, now)) return { key: 'attendance_pending', label: '출결미처리' }
  return { key: 'waiting', label: '상담대기' }
}

export function isSlotPast(slot, now = new Date()) {
  const [h, m] = String(slot.startTime).split(':').map(Number)
  const start = new Date(`${slot.date}T00:00:00`)
  start.setHours(h, m, 0, 0)
  return start <= now
}

// ─── 상담기록 상태 (명세 14.3) — 전부 파생 ────────────────────
// (정원 마감은 서버 집계 slotCounts[slot.id] >= slot.capacity 인라인 판정 — 별도 헬퍼 없음)
export const RECORD_DEADLINE_DAYS = 7

export const RECORD_STATE = {
  not_required: { label: '작성 대상 아님', color: 'bg-gray-100 text-gray-500' },
  none: { label: '미작성', color: 'bg-gray-100 text-gray-600' },
  draft: { label: '작성 중', color: 'bg-yellow-100 text-yellow-700' },
  due_soon: { label: '기한 임박', color: 'bg-orange-100 text-orange-700' },
  overdue: { label: '기한 초과', color: 'bg-red-100 text-red-600' },
  done: { label: '작성 완료', color: 'bg-green-100 text-green-700' },
  done_overdue: { label: '기한 초과 작성', color: 'bg-blue-100 text-blue-700' },
}

// reservation의 출결 + record 존재 여부 + 오늘 날짜로 기록 상태를 판정한다.
// slotDate: 'YYYY-MM-DD' (상담일). 작성기한 = 상담일 + 7일 23:59:59.
export function recordState(reservation, record, slotDate, today = todayStrKst()) {
  // 참석 처리된 상담만 작성 대상 — 미참석·사전취소·강사/센터 취소·일정변경·
  // 출결 미처리 상담은 작성 대상이 아니다 (명세 14.1·14.3)
  if (reservation.status !== 'confirmed' || reservation.attendanceStatus !== 'attended') {
    return 'not_required'
  }
  const deadline = addDaysStr(slotDate, RECORD_DEADLINE_DAYS)
  if (record?.status === 'done') {
    // completedAt은 UTC ISO — 문자열 절단 금지(dateUtils 규약), 로컬(KST) 날짜로 변환해 비교
    const completedDate = record.completedAt ? toDateStr(new Date(record.completedAt)) : today
    return completedDate > deadline ? 'done_overdue' : 'done'
  }
  if (today > deadline) return 'overdue'
  if (record?.status === 'draft') return 'draft'
  // 기한이 오늘·내일이면 임박
  if (addDaysStr(today, 1) >= deadline) return 'due_soon'
  return 'none'
}

// 출결 처리기한 = 상담일 다음 날 23:59:59 (명세 13.2)
export function attendanceDeadlinePassed(slotDate, today = todayStrKst()) {
  return today > addDaysStr(slotDate, 1)
}
