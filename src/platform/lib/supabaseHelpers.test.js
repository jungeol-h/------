import { describe, it, expect } from 'vitest'
import { toBookingCounselingRecord } from './supabaseHelpers.js'

// 예약 유래 상담의 시간 규칙 — 지도보고서에 작성된 실제 시간 우선, 미입력은 슬롯 폴백
// ("집계는 예약 기준이 아니라 작성 결과 기준", 2026-08-20 클라).
describe('toBookingCounselingRecord', () => {
  const base = {
    id: 'bkc-1',
    student_id: 's-1',
    educator_id: 'cs03',
    date: '2026-08-18',
    booking_reservations: { booking_slots: { start_time: '16:00:00', end_time: '16:40:00' } },
    booking_programs: { name: '진로진학 컨설팅' },
  }

  it('지도보고서에 작성된 실제 시간이 슬롯 시간보다 우선한다', () => {
    const r = toBookingCounselingRecord({ ...base, start_time: '16:05', end_time: '16:25' })
    expect(r.startTime).toBe('16:05')
    expect(r.endTime).toBe('16:25')
  })

  it('실제 시간 미입력(구 기록)은 예약 슬롯 시간으로 폴백한다', () => {
    const r = toBookingCounselingRecord({ ...base, start_time: null, end_time: null })
    expect(r.startTime).toBe('16:00')
    expect(r.endTime).toBe('16:40')
  })

  it('유형은 프로그램명으로 추정한다 — 진로 포함이면 career_path', () => {
    expect(toBookingCounselingRecord(base).type).toBe('career_path')
    expect(
      toBookingCounselingRecord({ ...base, booking_programs: { name: '교과 컨설팅' } }).type,
    ).toBe('subject_learning')
  })
})
