// 타임테이블 자동 생성 순수함수 테스트 — 겹침 차단·skipped 안내·래퍼 동등성.

import { describe, it, expect } from 'vitest'
import { generateSlots, generateSlotsDetailed } from './slotGeneration.js'

const BASE = {
  from: '2026-09-07', to: '2026-09-07', // 월요일
  weekdays: [], dayStart: '16:00', dayEnd: '17:00', slotMinutes: 20,
}

describe('generateSlotsDetailed', () => {
  it('겹치는 blocked 후보는 slots에서 제외하고 skipped로 보고한다', () => {
    const blocker = { id: 's1', date: '2026-09-07', startTime: '16:20', endTime: '16:40' }
    const { slots, skipped } = generateSlotsDetailed({ ...BASE, blocked: [blocker] })

    expect(slots).toEqual([
      { date: '2026-09-07', startTime: '16:00', endTime: '16:20', capacity: 1, educatorId: null, subjectId: null, isPublic: true, note: '' },
      { date: '2026-09-07', startTime: '16:40', endTime: '17:00', capacity: 1, educatorId: null, subjectId: null, isPublic: true, note: '' },
    ])
    expect(skipped).toEqual([
      { date: '2026-09-07', startTime: '16:20', endTime: '16:40', blockers: [blocker] },
    ])
  })

  it('blockers는 호출측 슬롯 객체를 그대로(참조) 보존한다', () => {
    const blocker = { id: 's1', date: '2026-09-07', startTime: '16:00', endTime: '16:20', note: '강사지정', ruleId: 'r1' }
    const { skipped } = generateSlotsDetailed({ ...BASE, blocked: [blocker] })

    expect(skipped[0].blockers[0]).toBe(blocker)
  })

  it('여러 blocked와 겹치면 blockers 배열에 전부 담긴다', () => {
    const b1 = { date: '2026-09-07', startTime: '16:00', endTime: '16:10' }
    const b2 = { date: '2026-09-07', startTime: '16:10', endTime: '16:20' }
    const { skipped } = generateSlotsDetailed({ ...BASE, blocked: [b1, b2] })

    expect(skipped[0].blockers).toEqual([b1, b2])
  })

  it('breaks로 제외된 후보는 skipped에 넣지 않는다', () => {
    const { slots, skipped } = generateSlotsDetailed({
      ...BASE, breaks: [{ start: '16:20', end: '16:40' }],
    })

    expect(slots).toEqual([
      { date: '2026-09-07', startTime: '16:00', endTime: '16:20', capacity: 1, educatorId: null, subjectId: null, isPublic: true, note: '' },
      { date: '2026-09-07', startTime: '16:40', endTime: '17:00', capacity: 1, educatorId: null, subjectId: null, isPublic: true, note: '' },
    ])
    expect(skipped).toEqual([])
  })

  it('excludeDates로 제외된 날짜의 후보도 skipped에 넣지 않는다', () => {
    const { slots, skipped } = generateSlotsDetailed({ ...BASE, excludeDates: ['2026-09-07'] })

    expect(slots).toEqual([])
    expect(skipped).toEqual([])
  })

  it('입력이 무효하면 빈 slots·skipped를 반환한다', () => {
    expect(generateSlotsDetailed({ ...BASE, from: '', to: '2026-09-07' })).toEqual({ slots: [], skipped: [] })
    expect(generateSlotsDetailed({ ...BASE, dayStart: '20:00', dayEnd: '16:00' })).toEqual({ slots: [], skipped: [] })
  })
})

describe('generateSlots (래퍼)', () => {
  it('generateSlotsDetailed(params).slots와 동일한 결과를 반환한다', () => {
    const blocker = { date: '2026-09-07', startTime: '16:20', endTime: '16:40' }
    const params = { ...BASE, blocked: [blocker] }

    expect(generateSlots(params)).toEqual(generateSlotsDetailed(params).slots)
  })

  it('기존 시그니처·동작을 그대로 유지한다 (겹침 없을 때)', () => {
    const slots = generateSlots(BASE)
    expect(slots).toHaveLength(3)
    expect(slots[0]).toEqual({
      date: '2026-09-07', startTime: '16:00', endTime: '16:20',
      capacity: 1, educatorId: null, subjectId: null, isPublic: true, note: '',
    })
  })
})

describe('generateSlotsDetailed — 운영 시간대 여러 개 (ranges)', () => {
  const RANGE_BASE = { from: '2026-10-17', to: '2026-10-18', weekdays: [0, 6], slotMinutes: 40 } // 토·일
  const times = (slots) => slots.map((s) => `${s.date} ${s.startTime}~${s.endTime}`)

  it('시간대마다 슬롯을 만들어 날짜·시간순으로 반환한다', () => {
    const slots = generateSlots({
      ...RANGE_BASE,
      ranges: [{ start: '17:00', end: '17:40' }, { start: '12:00', end: '12:40' }],
    })
    expect(times(slots)).toEqual([
      '2026-10-17 12:00~12:40', '2026-10-17 17:00~17:40',
      '2026-10-18 12:00~12:40', '2026-10-18 17:00~17:40',
    ])
  })

  it('ranges가 있으면 dayStart/dayEnd는 무시한다', () => {
    const slots = generateSlots({
      ...RANGE_BASE, to: '2026-10-17', dayStart: '09:00', dayEnd: '11:00',
      ranges: [{ start: '12:00', end: '12:40' }],
    })
    expect(times(slots)).toEqual(['2026-10-17 12:00~12:40'])
  })

  it('겹치는 시간대는 이른 시간대 슬롯이 우선하고 중복·겹침 슬롯을 만들지 않는다', () => {
    const slots = generateSlots({
      ...RANGE_BASE, to: '2026-10-17',
      ranges: [{ start: '12:00', end: '13:20' }, { start: '12:40', end: '14:00' }, { start: '13:00', end: '14:40' }],
    })
    // 셋째 시간대(13:00~)는 자기 격자(13:00·13:40·14:20)로 돈다 — 13:00·13:40은 앞 슬롯과
    // 겹쳐 버려지고 14:20~15:00은 종료(14:40)를 넘으므로 추가되는 슬롯이 없다
    expect(times(slots)).toEqual([
      '2026-10-17 12:00~12:40', '2026-10-17 12:40~13:20', '2026-10-17 13:20~14:00',
    ])
  })

  it('미완성(빈 값·종료≤시작) 시간대는 건너뛴다', () => {
    const slots = generateSlots({
      ...RANGE_BASE, to: '2026-10-17',
      ranges: [{ start: '12:00', end: '12:40' }, { start: '', end: '' }, { start: '18:00', end: '17:00' }],
    })
    expect(times(slots)).toEqual(['2026-10-17 12:00~12:40'])
  })
})
