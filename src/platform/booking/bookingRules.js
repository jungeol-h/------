// 예약 규칙 엔진 — add-booking-system.sql의 RPC 검증(_booking_validate 등)의
// 순수함수 미러. 버튼 비활성·사전 안내에 쓰는 UX용 사전 검증이다.
//
// 최종심은 항상 DB RPC(now() KST 기준) — 여기서 통과해도 RPC가 거절할 수 있고
// (로컬 시계 오차·동시성), 그때도 같은 코드 → 같은 안내문이 뜬다.
//
// 반환 규약: { ok: boolean, code: string } — code는 bookingMessages.js 키와 1:1.
// 모든 함수는 순수함수(React·supabase 의존 없음) — bookingRules.test.js로 전수 검증.

import { toDateStr, todayStr } from '../utils/dateUtils.js'
import { timeToMinutes } from '../context/selectors/attendance.js'

export { timeToMinutes }
export const todayStrKst = todayStr

// ─── 날짜·시간 헬퍼 ───────────────────────────────────────────

// 'YYYY-MM-DD' + n일 (로컬 기준 — dateUtils 규약)
export function addDaysStr(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + n))
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// 슬롯 시작 시각의 Date (로컬 = KST 전제 — 코드베이스 공통)
export function slotStartDate(slot) {
  const [y, m, d] = slot.date.split('-').map(Number)
  const [h, min] = String(slot.startTime).split(':').map(Number)
  return new Date(y, m - 1, d, h, min, 0, 0)
}

// ─── 시간 겹침 (명세 7.2) ─────────────────────────────────────
// strict overlap: 시작 < 기존종료 && 종료 > 기존시작.
// 인접 블록(끝 == 시작)은 겹침이 아니다 → 교과 연속 2블록이 자연 허용된다.
// 'HH:MM' 제로패딩 문자열은 사전순 비교가 시각 비교와 일치한다.
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart
}

// 인접(연속) 판정 — 자기주도학습 코칭 연속예약 금지용 (명세 4.3)
export function isAdjacent(aStart, aEnd, bStart, bEnd) {
  return aEnd === bStart || bEnd === aStart
}

// ─── 변경·취소 기한 (명세 8·9) — RPC _booking_deadline_ok 미러 ──
// days_before   : 오늘 <= 상담일 - N일 인 동안 허용 (D-N 23:59:59까지)
// minutes_before: now < 시작시각 - N분 인 동안 허용
export function deadlineOk(program, slot, now = new Date()) {
  if (program.changeDeadlineType === 'days_before') {
    return toDateStr(now) <= addDaysStr(slot.date, -program.changeDeadlineValue)
  }
  return now.getTime() < slotStartDate(slot).getTime() - program.changeDeadlineValue * 60_000
}

// ─── 그룹 대상 (groupScope.js 규약: 무소속 = 전체) ─────────────
export function isTargetGroup(studentGroups, program) {
  const target = program.targetGroupNames ?? []
  if (target.length === 0) return true
  const mine = studentGroups ?? []
  if (mine.length === 0) return true
  return mine.some((g) => target.includes(g))
}

// ─── 오픈기간 (명세 6.2) ──────────────────────────────────────
export function inOpenPeriod(openPeriods, program, slotDate, now = new Date()) {
  const nowIso = now.toISOString()
  return openPeriods.some((p) =>
    p.programId === program.id &&
    nowIso >= new Date(p.openFrom).toISOString() &&
    nowIso <= new Date(p.openUntil).toISOString() &&
    slotDate >= p.targetStart && slotDate <= p.targetEnd,
  )
}

// ─── 당일 접수창 (명세 6.1) ───────────────────────────────────
// 그날 공개 슬롯의 첫 시작 N분 전 ~ 마지막 종료 N분 전. 당일 슬롯에만 적용.
// daySlots: 같은 프로그램·같은 날짜의 status='open' 슬롯 전부.
export function inBookingWindow(program, daySlots, now = new Date()) {
  if (daySlots.length === 0) return true
  let dayStart = Infinity
  let dayEnd = -Infinity
  for (const s of daySlots) {
    dayStart = Math.min(dayStart, timeToMinutes(s.startTime))
    dayEnd = Math.max(dayEnd, timeToMinutes(s.endTime))
  }
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return nowMin >= dayStart - program.bookingOpenLeadMinutes &&
         nowMin <= dayEnd - program.bookingCloseLeadMinutes
}

// ─── 하루 횟수 제한 (명세 4장) ────────────────────────────────
// reservations: 학생의 확정 예약 (각 항목에 .slot 내장). daily_limit_scope별 합산.
export function dailyCount(program, slot, reservations, excludeId = null) {
  let n = 0
  for (const r of reservations) {
    if (r.status !== 'confirmed' || r.programId !== program.id) continue
    if (excludeId && r.id === excludeId) continue
    const s = r.slot
    if (!s || s.date !== slot.date) continue
    if (program.dailyLimitScope === 'program_educator' &&
        (s.educatorId ?? null) !== (slot.educatorId ?? null)) continue
    if (program.dailyLimitScope === 'program_subject' &&
        (s.subjectId ?? null) !== (slot.subjectId ?? null)) continue
    n += 1
  }
  return n
}

// ─── 예약 가능 검증 본체 — RPC _booking_validate 미러 ──────────
// ctx:
//   program        대상 프로그램
//   slot           대상 슬롯
//   daySlots       같은 프로그램·같은 날 open 슬롯 (접수창 판정용)
//   openPeriods    오픈기간 목록
//   studentGroups  학생 group_names
//   reservations   학생의 확정 예약 (각 항목 .slot 내장)
//   slotCounts     { [slotId]: 확정 예약 수 } (정원 판정용)
//   isStaff        강사·관리자 여부 (공개 상태 검증 완화)
//   excludeId      변경 시 제외할 기존 예약 id
export function validateReserve(ctx, now = new Date()) {
  const {
    program, slot, daySlots = [], openPeriods = [], studentGroups = [],
    reservations = [], slotCounts = {}, isStaff = false, excludeId = null,
  } = ctx

  if (!isStaff) {
    if (slot.status !== 'open' || !program.active) return { ok: false, code: 'SLOT_NOT_OPEN' }
    if (!slot.isPublic) return { ok: false, code: 'SLOT_NOT_OPEN' }
  }
  if (slotStartDate(slot) <= now) return { ok: false, code: 'PAST_SLOT' }
  if (!isTargetGroup(studentGroups, program)) return { ok: false, code: 'NOT_TARGET_GROUP' }

  if (program.requiresOpenPeriod) {
    if (!isStaff && !inOpenPeriod(openPeriods, program, slot.date, now)) {
      return { ok: false, code: 'OUT_OF_OPEN_PERIOD' }
    }
  } else if (slot.date === toDateStr(now)) {
    // 접수창은 당일 슬롯에만 적용 (해석 결정 — SQL과 동일, booking/README.md 참고)
    if (!isStaff && !inBookingWindow(program, daySlots, now)) {
      return { ok: false, code: 'WINDOW_CLOSED' }
    }
  }

  for (const r of reservations) {
    if (r.status !== 'confirmed' || !r.slot) continue
    if (excludeId && r.id === excludeId) continue
    if (r.slotId === slot.id) return { ok: false, code: 'ALREADY_BOOKED' }
  }

  for (const r of reservations) {
    if (r.status !== 'confirmed' || !r.slot) continue
    if (excludeId && r.id === excludeId) continue
    if (r.slot.date !== slot.date) continue
    if (overlaps(slot.startTime, slot.endTime, r.slot.startTime, r.slot.endTime)) {
      return { ok: false, code: 'OVERLAP' }
    }
  }

  if (dailyCount(program, slot, reservations, excludeId) >= program.dailyLimit) {
    return { ok: false, code: 'DAILY_LIMIT' }
  }

  if (!program.allowConsecutive) {
    for (const r of reservations) {
      if (r.status !== 'confirmed' || !r.slot) continue
      if (excludeId && r.id === excludeId) continue
      if (r.programId !== program.id || r.slot.date !== slot.date) continue
      if (isAdjacent(slot.startTime, slot.endTime, r.slot.startTime, r.slot.endTime)) {
        return { ok: false, code: 'CONSECUTIVE_FORBIDDEN' }
      }
    }
  }

  // 정원 — 같은 슬롯으로의 변경은 RPC가 INVALID로 거절하므로 exclude 보정 불필요
  if ((slotCounts[slot.id] ?? 0) >= slot.capacity) return { ok: false, code: 'SLOT_FULL' }

  return { ok: true, code: 'OK' }
}

// ─── 취소 검증 (명세 9) ───────────────────────────────────────
export function validateCancel({ program, slot, isStaff = false }, now = new Date()) {
  if (!isStaff && !deadlineOk(program, slot, now)) {
    return { ok: false, code: 'DEADLINE_PASSED' }
  }
  return { ok: true, code: 'OK' }
}

// ─── 변경 검증 (명세 8.1 순서: 기존 기한 → 새 슬롯 전체 검증) ──
export function validateChange({ oldProgram, oldSlot, reservationId, isStaff = false, ...newCtx }, now = new Date()) {
  if (!isStaff && !deadlineOk(oldProgram, oldSlot, now)) {
    return { ok: false, code: 'DEADLINE_PASSED' }
  }
  if (newCtx.slot && oldSlot && newCtx.slot.id === oldSlot.id) {
    return { ok: false, code: 'INVALID' }
  }
  return validateReserve({ ...newCtx, isStaff, excludeId: reservationId }, now)
}
