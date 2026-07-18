// 예약 규칙 엔진 테스트 — 명세 23장 "필수 검수 시나리오"의 규칙 파트를 전수 인코딩.
// (E2E 흐름·동시성·알림은 수동 검수 — booking/README.md 체크리스트)

import { describe, it, expect } from 'vitest'
import {
  addDaysStr, overlaps, isAdjacent, deadlineOk, isTargetGroup,
  inOpenPeriod, inBookingWindow, dailyCount, validateReserve,
  validateCancel, validateChange, slotStartDate, minutesToTime,
  changeDeadlineLabel,
} from './bookingRules.js'
import { generateSlots } from './slotGeneration.js'

// ─── 픽스처 (시드 3종 프로그램 미러) ──────────────────────────

const CAREER = {
  id: 'p-career', name: '진로진학 컨설팅', active: true,
  slotMinutes: 40, dailyLimit: 1, dailyLimitScope: 'program_educator',
  allowConsecutive: true, requiresOpenPeriod: true,
  changeDeadlineType: 'days_before', changeDeadlineValue: 2,
  bookingOpenLeadMinutes: 60, bookingCloseLeadMinutes: 60,
  targetGroupNames: [],
}
const SUBJECT = {
  id: 'p-subject', name: '교과 컨설팅', active: true,
  slotMinutes: 20, dailyLimit: 2, dailyLimitScope: 'program_subject',
  allowConsecutive: true, requiresOpenPeriod: false,
  changeDeadlineType: 'minutes_before', changeDeadlineValue: 60,
  bookingOpenLeadMinutes: 60, bookingCloseLeadMinutes: 60,
  targetGroupNames: [],
}
const COACHING = {
  id: 'p-coach', name: '자기주도학습 코칭', active: true,
  slotMinutes: 20, dailyLimit: 2, dailyLimitScope: 'program',
  allowConsecutive: false, requiresOpenPeriod: false,
  changeDeadlineType: 'minutes_before', changeDeadlineValue: 60,
  bookingOpenLeadMinutes: 60, bookingCloseLeadMinutes: 60,
  targetGroupNames: [],
}

let seq = 0
function slot(program, date, startTime, endTime, extra = {}) {
  return {
    id: extra.id ?? `sl-${++seq}`,
    programId: program.id,
    educatorId: extra.educatorId ?? 'e1',
    subjectId: extra.subjectId ?? null,
    date, startTime, endTime,
    capacity: extra.capacity ?? 1,
    status: extra.status ?? 'open',
    isPublic: extra.isPublic ?? true,
  }
}

function res(program, s, extra = {}) {
  return {
    id: extra.id ?? `r-${++seq}`,
    slotId: s.id, programId: program.id, studentId: 'st1',
    status: extra.status ?? 'confirmed', slot: s,
  }
}

// 미래의 화요일 오후 (예약 판정 기준 시각)
const NOW = new Date('2026-08-04T10:00:00') // 화요일 10:00
const DAY = '2026-08-04'
const NEXT_DAY = '2026-08-05'

function ctx(program, target, over = {}) {
  return { program, slot: target, daySlots: [], openPeriods: [], studentGroups: [], reservations: [], slotCounts: {}, ...over }
}

// ─── 시간 겹침 (23. 예약 제한) ────────────────────────────────

describe('overlaps — 시간구간 겹침', () => {
  it('40분 상담과 일부만 겹치는 20분 예약도 겹침이다', () => {
    // 진로진학 16:00~16:40 vs 교과 16:20~16:40
    expect(overlaps('16:20', '16:40', '16:00', '16:40')).toBe(true)
  })
  it('인접 블록(끝=시작)은 겹침이 아니다', () => {
    expect(overlaps('16:00', '16:20', '16:20', '16:40')).toBe(false)
    expect(overlaps('16:20', '16:40', '16:00', '16:20')).toBe(false)
  })
  it('완전 포함·동일 구간은 겹침이다', () => {
    expect(overlaps('16:00', '16:40', '16:10', '16:30')).toBe(true)
    expect(overlaps('16:00', '16:20', '16:00', '16:20')).toBe(true)
  })
})

describe('validateReserve — 동일 시간대 중복 (프로그램 횡단)', () => {
  it('서로 다른 프로그램이라도 시간이 겹치면 차단된다', () => {
    const careerSlot = slot(CAREER, NEXT_DAY, '16:00', '16:40')
    const subjectSlot = slot(SUBJECT, NEXT_DAY, '16:20', '16:40')
    const r = validateReserve(ctx(SUBJECT, subjectSlot, {
      reservations: [res(CAREER, careerSlot)],
    }), NOW)
    expect(r.code).toBe('OVERLAP')
  })
  it('서로 다른 컨설턴트라도 시간이 겹치면 차단된다', () => {
    const a = slot(CAREER, NEXT_DAY, '16:00', '16:40', { educatorId: 'eA' })
    const b = slot(CAREER, NEXT_DAY, '16:00', '16:40', { educatorId: 'eB' })
    const r = validateReserve(ctx(CAREER, b, {
      reservations: [res(CAREER, a)],
      openPeriods: [{ programId: CAREER.id, targetStart: NEXT_DAY, targetEnd: NEXT_DAY, openFrom: '2026-08-01T00:00:00+09:00', openUntil: '2026-08-31T23:59:59+09:00' }],
    }), NOW)
    expect(r.code).toBe('OVERLAP')
  })
  it('취소된 예약은 중복검사 대상이 아니다', () => {
    const a = slot(SUBJECT, NEXT_DAY, '16:00', '16:20')
    const b = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', { educatorId: 'e2' })
    const r = validateReserve(ctx(SUBJECT, b, {
      reservations: [res(SUBJECT, a, { status: 'cancelled' })],
    }), NOW)
    expect(r.ok).toBe(true)
  })
})

// ─── 교과 컨설팅 — 교과별 하루 2블록 (명세 4.2) ────────────────

describe('교과 컨설팅 — 교과별 하루 2블록', () => {
  const kor = { subjectId: 'sj-kor' }
  const eng = { subjectId: 'sj-eng' }

  it('같은 교과 2블록까지 예약된다 (연속·비연속 모두)', () => {
    const s1 = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', kor)
    const s2consec = slot(SUBJECT, NEXT_DAY, '16:20', '16:40', kor)
    const s2gap = slot(SUBJECT, NEXT_DAY, '17:00', '17:20', kor)
    expect(validateReserve(ctx(SUBJECT, s2consec, { reservations: [res(SUBJECT, s1)] }), NOW).ok).toBe(true)
    expect(validateReserve(ctx(SUBJECT, s2gap, { reservations: [res(SUBJECT, s1)] }), NOW).ok).toBe(true)
  })
  it('동일 교과 3번째 블록은 차단된다 — 강사가 달라도 합산', () => {
    const s1 = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', { ...kor, educatorId: 'eA' })
    const s2 = slot(SUBJECT, NEXT_DAY, '17:00', '17:20', { ...kor, educatorId: 'eB' })
    const s3 = slot(SUBJECT, NEXT_DAY, '18:00', '18:20', { ...kor, educatorId: 'eC' })
    const r = validateReserve(ctx(SUBJECT, s3, {
      reservations: [res(SUBJECT, s1), res(SUBJECT, s2)],
    }), NOW)
    expect(r.code).toBe('DAILY_LIMIT')
  })
  it('다른 교과는 별도로 2블록까지 가능하다', () => {
    const k1 = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', kor)
    const k2 = slot(SUBJECT, NEXT_DAY, '16:20', '16:40', kor)
    const e1 = slot(SUBJECT, NEXT_DAY, '17:00', '17:20', eng)
    const r = validateReserve(ctx(SUBJECT, e1, {
      reservations: [res(SUBJECT, k1), res(SUBJECT, k2)],
    }), NOW)
    expect(r.ok).toBe(true)
  })
})

// ─── 자기주도학습 코칭 — 하루 2블록 + 연속 금지 (명세 4.3) ─────

describe('자기주도학습 코칭 — 연속예약 금지', () => {
  it('연속예약(앞뒤 모두)이 차단된다 — 코치가 달라도', () => {
    const s1 = slot(COACHING, NEXT_DAY, '16:00', '16:20', { educatorId: 'eA' })
    const after = slot(COACHING, NEXT_DAY, '16:20', '16:40', { educatorId: 'eB' })
    const before = slot(COACHING, NEXT_DAY, '15:40', '16:00', { educatorId: 'eB' })
    expect(validateReserve(ctx(COACHING, after, { reservations: [res(COACHING, s1)] }), NOW).code)
      .toBe('CONSECUTIVE_FORBIDDEN')
    expect(validateReserve(ctx(COACHING, before, { reservations: [res(COACHING, s1)] }), NOW).code)
      .toBe('CONSECUTIVE_FORBIDDEN')
  })
  it('비연속 2회는 가능하다', () => {
    const s1 = slot(COACHING, NEXT_DAY, '16:00', '16:20')
    const s2 = slot(COACHING, NEXT_DAY, '16:40', '17:00')
    expect(validateReserve(ctx(COACHING, s2, { reservations: [res(COACHING, s1)] }), NOW).ok).toBe(true)
  })
  it('3번째 블록은 차단된다', () => {
    const s1 = slot(COACHING, NEXT_DAY, '16:00', '16:20')
    const s2 = slot(COACHING, NEXT_DAY, '17:00', '17:20')
    const s3 = slot(COACHING, NEXT_DAY, '18:00', '18:20')
    expect(validateReserve(ctx(COACHING, s3, {
      reservations: [res(COACHING, s1), res(COACHING, s2)],
    }), NOW).code).toBe('DAILY_LIMIT')
  })
  it('다른 프로그램 예약과의 인접은 막지 않는다 (교과 직후 코칭 허용)', () => {
    const sub = slot(SUBJECT, NEXT_DAY, '16:00', '16:20')
    const coach = slot(COACHING, NEXT_DAY, '16:20', '16:40')
    expect(validateReserve(ctx(COACHING, coach, { reservations: [res(SUBJECT, sub)] }), NOW).ok).toBe(true)
  })
})

// ─── 진로진학 — 동일 컨설턴트 하루 1회 (명세 4.1) ─────────────

describe('진로진학 — 동일 컨설턴트 하루 1회', () => {
  const period = { programId: CAREER.id, targetStart: '2026-08-01', targetEnd: '2026-08-31', openFrom: '2026-08-01T00:00:00+09:00', openUntil: '2026-08-31T23:59:59+09:00' }

  it('동일 컨설턴트에게 하루 2회는 차단된다', () => {
    const s1 = slot(CAREER, NEXT_DAY, '16:00', '16:40', { educatorId: 'eA' })
    const s2 = slot(CAREER, NEXT_DAY, '18:00', '18:40', { educatorId: 'eA' })
    expect(validateReserve(ctx(CAREER, s2, {
      reservations: [res(CAREER, s1)], openPeriods: [period],
    }), NOW).code).toBe('DAILY_LIMIT')
  })
  it('서로 다른 컨설턴트에게는 같은 날 각각 예약할 수 있다', () => {
    const s1 = slot(CAREER, NEXT_DAY, '16:00', '16:40', { educatorId: 'eA' })
    const s2 = slot(CAREER, NEXT_DAY, '18:00', '18:40', { educatorId: 'eB' })
    expect(validateReserve(ctx(CAREER, s2, {
      reservations: [res(CAREER, s1)], openPeriods: [period],
    }), NOW).ok).toBe(true)
  })
})

// ─── 변경·취소 기한 (명세 8·9, 23. 변경·취소) ─────────────────

describe('deadlineOk — 교과·코칭 시작 60분 전', () => {
  const s = slot(SUBJECT, '2026-08-04', '16:00', '16:20')
  it('14:59:59까지 변경·취소 가능', () => {
    expect(deadlineOk(SUBJECT, s, new Date('2026-08-04T14:59:59'))).toBe(true)
  })
  it('15:00:00부터 차단', () => {
    expect(deadlineOk(SUBJECT, s, new Date('2026-08-04T15:00:00'))).toBe(false)
  })
})

describe('deadlineOk — 진로진학 D-2 자정 경계', () => {
  const s = slot(CAREER, '2026-07-10', '16:00', '16:40')
  it('D-2(7/8) 23:59:59까지 가능', () => {
    expect(deadlineOk(CAREER, s, new Date('2026-07-08T23:59:59'))).toBe(true)
  })
  it('D-1(7/9) 00:00:00부터 차단', () => {
    expect(deadlineOk(CAREER, s, new Date('2026-07-09T00:00:00'))).toBe(false)
  })
})

describe('validateCancel / validateChange', () => {
  const s = slot(SUBJECT, '2026-08-04', '16:00', '16:20')
  it('기한 초과 시 취소가 차단되고 관리자 문의 코드가 나온다', () => {
    expect(validateCancel({ program: SUBJECT, slot: s }, new Date('2026-08-04T15:30:00')).code)
      .toBe('DEADLINE_PASSED')
  })
  it('강사·관리자는 기한과 무관하게 취소할 수 있다', () => {
    expect(validateCancel({ program: SUBJECT, slot: s, isStaff: true }, new Date('2026-08-04T15:30:00')).ok)
      .toBe(true)
  })
  it('변경은 기존 예약 기한을 먼저 검사한다', () => {
    const target = slot(SUBJECT, '2026-08-04', '18:00', '18:20')
    const r = validateChange({
      oldProgram: SUBJECT, oldSlot: s, reservationId: 'r-old',
      program: SUBJECT, slot: target,
    }, new Date('2026-08-04T15:30:00'))
    expect(r.code).toBe('DEADLINE_PASSED')
  })
  it('변경 시 기존 예약은 겹침·횟수 검사에서 제외된다 (같은 시간대 강사 변경 허용)', () => {
    const oldSlot = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', { educatorId: 'eA', id: 'sl-old' })
    const newSlot = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', { educatorId: 'eB', id: 'sl-new' })
    const myRes = res(SUBJECT, oldSlot, { id: 'r-old' })
    const r = validateChange({
      oldProgram: SUBJECT, oldSlot, reservationId: 'r-old',
      program: SUBJECT, slot: newSlot, reservations: [myRes],
      daySlots: [], openPeriods: [], studentGroups: [], slotCounts: {},
    }, NOW)
    expect(r.ok).toBe(true)
  })
  it('같은 슬롯으로의 변경은 무효다', () => {
    const same = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', { id: 'sl-same' })
    const r = validateChange({
      oldProgram: SUBJECT, oldSlot: same, reservationId: 'r1',
      program: SUBJECT, slot: same,
    }, NOW)
    expect(r.code).toBe('INVALID')
  })
})

// ─── 정원·과거 슬롯·공개 상태 ─────────────────────────────────

describe('validateReserve — 정원·과거·공개 상태', () => {
  it('정원이 찬 슬롯은 SLOT_FULL', () => {
    const s = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', { capacity: 2 })
    expect(validateReserve(ctx(SUBJECT, s, { slotCounts: { [s.id]: 2 } }), NOW).code).toBe('SLOT_FULL')
    expect(validateReserve(ctx(SUBJECT, s, { slotCounts: { [s.id]: 1 } }), NOW).ok).toBe(true)
  })
  it('이미 시작됐거나 지난 슬롯은 PAST_SLOT', () => {
    const s = slot(SUBJECT, DAY, '10:00', '10:20')
    expect(validateReserve(ctx(SUBJECT, s), new Date('2026-08-04T10:00:00')).code).toBe('PAST_SLOT')
    expect(validateReserve(ctx(SUBJECT, s), new Date('2026-08-04T09:59:00')).ok).toBe(true)
  })
  it('작성중·비공개 슬롯은 학생에게 SLOT_NOT_OPEN, 강사·관리자는 허용', () => {
    const draft = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', { status: 'draft' })
    const hidden = slot(SUBJECT, NEXT_DAY, '16:00', '16:20', { isPublic: false })
    expect(validateReserve(ctx(SUBJECT, draft), NOW).code).toBe('SLOT_NOT_OPEN')
    expect(validateReserve(ctx(SUBJECT, hidden), NOW).code).toBe('SLOT_NOT_OPEN')
    expect(validateReserve(ctx(SUBJECT, hidden, { isStaff: true }), NOW).ok).toBe(true)
  })
})

// ─── 오픈기간·접수창 (명세 6) ─────────────────────────────────

describe('inOpenPeriod — 진로진학 월 단위 접수기간', () => {
  const period = { programId: CAREER.id, targetStart: '2026-09-01', targetEnd: '2026-09-30', openFrom: '2026-08-25T09:00:00+09:00', openUntil: '2026-08-31T23:59:59+09:00' }
  it('접수기간 내 + 대상 월 슬롯이면 허용', () => {
    expect(inOpenPeriod([period], CAREER, '2026-09-10', new Date('2026-08-26T10:00:00+09:00'))).toBe(true)
  })
  it('접수기간 밖이면 차단', () => {
    expect(inOpenPeriod([period], CAREER, '2026-09-10', new Date('2026-09-01T10:00:00+09:00'))).toBe(false)
  })
  it('대상 기간 밖의 슬롯이면 차단', () => {
    expect(inOpenPeriod([period], CAREER, '2026-10-05', new Date('2026-08-26T10:00:00+09:00'))).toBe(false)
  })
})

describe('inBookingWindow — 당일 접수창 (운영 시작 1시간 전 ~ 종료 1시간 전)', () => {
  // 운영 16:00~21:00 → 접수 15:00~20:00
  const daySlots = [
    slot(SUBJECT, DAY, '16:00', '16:20'),
    slot(SUBJECT, DAY, '20:40', '21:00'),
  ]
  it('15:00부터 접수 가능', () => {
    expect(inBookingWindow(SUBJECT, daySlots, new Date('2026-08-04T15:00:00'))).toBe(true)
    expect(inBookingWindow(SUBJECT, daySlots, new Date('2026-08-04T14:59:00'))).toBe(false)
  })
  it('20:00까지 접수 가능', () => {
    expect(inBookingWindow(SUBJECT, daySlots, new Date('2026-08-04T20:00:00'))).toBe(true)
    expect(inBookingWindow(SUBJECT, daySlots, new Date('2026-08-04T20:01:00'))).toBe(false)
  })
  it('미래 일자 슬롯에는 접수창을 적용하지 않는다', () => {
    const s = slot(SUBJECT, NEXT_DAY, '16:00', '16:20')
    // NOW(10:00)는 접수창 밖이지만 내일 슬롯이라 허용
    expect(validateReserve(ctx(SUBJECT, s, { daySlots }), NOW).ok).toBe(true)
  })
})

// ─── 그룹 대상 (프로그램별 대상 그룹) ─────────────────────────

describe('isTargetGroup', () => {
  const naviOnly = { ...SUBJECT, targetGroupNames: ['안동NAVI'] }
  it('대상 그룹 학생만 허용', () => {
    expect(isTargetGroup(['안동NAVI'], naviOnly)).toBe(true)
    expect(isTargetGroup(['산청우정학사'], naviOnly)).toBe(false)
  })
  it('프로그램 대상이 비어 있으면 전체 허용', () => {
    expect(isTargetGroup(['산청우정학사'], SUBJECT)).toBe(true)
  })
  it('무소속 학생은 전체 허용 (groupScope 규약)', () => {
    expect(isTargetGroup([], naviOnly)).toBe(true)
  })
})

// ─── 학부모 통합 제한 (명세 3.2) ──────────────────────────────
// 제한은 예약자 계정이 아니라 학생 기준 — reservations가 "학생의" 예약 목록이므로
// 학부모가 예약해도 같은 목록으로 검증된다는 것을 명시적으로 확인.

describe('학생 기준 통합 제한', () => {
  it('학생이 예약한 시간을 학부모(같은 학생) 예약에서도 차단한다', () => {
    const s1 = slot(CAREER, NEXT_DAY, '16:00', '16:40')
    const s2 = slot(SUBJECT, NEXT_DAY, '16:00', '16:20')
    // 학부모 예약 시에도 ctx.reservations는 자녀(학생)의 예약 목록이다
    const byParent = validateReserve(ctx(SUBJECT, s2, {
      reservations: [res(CAREER, s1)], // 학생 본인이 만든 예약
    }), NOW)
    expect(byParent.code).toBe('OVERLAP')
  })
})

// ─── 슬롯 자동 생성 (명세 5.3) ────────────────────────────────

describe('generateSlots', () => {
  it('운영시간을 시간 단위로 채운다 (16:00~20:00, 20분 → 12개)', () => {
    const slots = generateSlots({
      from: DAY, to: DAY, weekdays: [2], dayStart: '16:00', dayEnd: '20:00', slotMinutes: 20,
    })
    expect(slots).toHaveLength(12)
    expect(slots[0]).toMatchObject({ date: DAY, startTime: '16:00', endTime: '16:20' })
    expect(slots[11]).toMatchObject({ startTime: '19:40', endTime: '20:00' })
  })
  it('마지막 불완전 슬롯은 생성하지 않는다 (종료 20:00, 40분 → 19:40 시작 없음)', () => {
    const slots = generateSlots({
      from: DAY, to: DAY, weekdays: [2], dayStart: '16:00', dayEnd: '20:00', slotMinutes: 40,
    })
    expect(slots).toHaveLength(6)
    expect(slots[slots.length - 1]).toMatchObject({ startTime: '19:20', endTime: '20:00' })
  })
  it('운영요일이 아닌 날짜는 건너뛴다', () => {
    // 2026-08-04(화)~08-05(수), 화요일만 운영
    const slots = generateSlots({
      from: DAY, to: NEXT_DAY, weekdays: [2], dayStart: '16:00', dayEnd: '17:00', slotMinutes: 20,
    })
    expect(slots.every((s) => s.date === DAY)).toBe(true)
  })
  it('휴무일과 휴식시간을 제외한다', () => {
    const slots = generateSlots({
      from: DAY, to: NEXT_DAY, weekdays: [2, 3], dayStart: '16:00', dayEnd: '18:00', slotMinutes: 20,
      excludeDates: [NEXT_DAY],
      breaks: [{ start: '17:00', end: '17:20' }],
    })
    expect(slots.every((s) => s.date === DAY)).toBe(true)
    expect(slots.some((s) => s.startTime === '17:00')).toBe(false)
    expect(slots.some((s) => s.startTime === '17:20')).toBe(true)
  })
  it('잘못된 입력은 빈 배열', () => {
    expect(generateSlots({ from: NEXT_DAY, to: DAY, dayStart: '16:00', dayEnd: '20:00', slotMinutes: 20 })).toEqual([])
    expect(generateSlots({ from: DAY, to: DAY, dayStart: '20:00', dayEnd: '16:00', slotMinutes: 20 })).toEqual([])
  })
})

// ─── 헬퍼 경계 ────────────────────────────────────────────────

describe('헬퍼', () => {
  it('addDaysStr — 월말·자정 경계', () => {
    expect(addDaysStr('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDaysStr('2026-07-10', -2)).toBe('2026-07-08')
  })
  it('minutesToTime', () => {
    expect(minutesToTime(960)).toBe('16:00')
    expect(minutesToTime(75)).toBe('01:15')
  })
  it('isAdjacent', () => {
    expect(isAdjacent('16:00', '16:20', '16:20', '16:40')).toBe(true)
    expect(isAdjacent('16:00', '16:20', '16:40', '17:00')).toBe(false)
  })
  it('slotStartDate', () => {
    const d = slotStartDate({ date: '2026-08-04', startTime: '16:00' })
    expect(d.getHours()).toBe(16)
    expect(d.getDate()).toBe(4)
  })
  it('changeDeadlineLabel — 기한 표시 문자열 (명세 7.4)', () => {
    expect(changeDeadlineLabel(CAREER, slot(CAREER, '2026-07-10', '16:00', '16:40')))
      .toBe('2026-07-08 23:59까지')
    expect(changeDeadlineLabel(SUBJECT, slot(SUBJECT, '2026-08-04', '16:00', '16:20')))
      .toBe('2026-08-04 15:00까지')
  })
  it('dailyCount — moved·cancelled 예약은 세지 않는다', () => {
    const s1 = slot(COACHING, NEXT_DAY, '16:00', '16:20')
    const s2 = slot(COACHING, NEXT_DAY, '18:00', '18:20')
    const target = slot(COACHING, NEXT_DAY, '17:00', '17:20')
    const list = [res(COACHING, s1, { status: 'moved' }), res(COACHING, s2, { status: 'cancelled' })]
    expect(dailyCount(COACHING, target, list)).toBe(0)
  })
})
