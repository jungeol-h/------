import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sentry.js', () => ({
  reportError: vi.fn(),
}))

import {
  toBookingCounselingRecord,
  collectRows,
  reportFinalFetchFailure,
} from './supabaseHelpers.js'
import { reportError } from './sentry.js'

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

// 침묵 실패 방지 헬퍼 — 일시적 네트워크 실패는 재시도 소진 후 1건만 Sentry에 보고하고
// (블립 잡음 NAMEKE-8 방지), 비-일시적 에러(권한 등)는 즉시 보고한다.
describe('collectRows', () => {
  beforeEach(() => {
    reportError.mockClear()
  })

  it('일시적(transient) 에러는 errors에만 수집하고 Sentry 즉시 보고는 하지 않는다', () => {
    const errors = []
    const res = { data: null, error: { message: 'TypeError: Load failed (host)' } }

    const rows = collectRows(res, 'users', errors)

    expect(rows).toEqual([])
    expect(errors).toEqual([
      { table: 'users', message: 'TypeError: Load failed (host)', code: null, transient: true },
    ])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('비-일시적 에러(권한 등)는 즉시 1회 보고한다', () => {
    const errors = []
    const error = { message: 'permission denied', code: '42501' }

    const rows = collectRows({ data: null, error }, 'tasks', errors)

    expect(rows).toEqual([])
    expect(errors).toEqual([
      { table: 'tasks', message: 'permission denied', code: '42501', transient: false },
    ])
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(error, { where: 'fetch', table: 'tasks' })
  })

  it('성공 결과는 data를 그대로 돌려주고 errors를 건드리지 않는다', () => {
    const errors = []
    const data = [{ id: 1 }, { id: 2 }]

    const rows = collectRows({ data, error: null }, 'users', errors)

    expect(rows).toBe(data)
    expect(errors).toEqual([])
    expect(reportError).not.toHaveBeenCalled()
  })
})

describe('reportFinalFetchFailure', () => {
  beforeEach(() => {
    reportError.mockClear()
  })

  it('transient 항목만 묶어 1건으로 보고한다 — 비-transient는 이미 보고됐으므로 제외', () => {
    const fetchErrors = [
      { table: 'users', message: 'TypeError: Load failed', code: null, transient: true },
      { table: 'tasks', message: 'permission denied', code: '42501', transient: false },
      { table: 'alerts', message: 'Failed to fetch', code: null, transient: true },
    ]

    reportFinalFetchFailure(fetchErrors, { attempt: 3 })

    expect(reportError).toHaveBeenCalledTimes(1)
    const [captured, context] = reportError.mock.calls[0]
    expect(captured).toBeInstanceOf(Error)
    expect(captured.name).toBe('SupabaseError')
    expect(captured.message).toBe('TypeError: Load failed')
    expect(context.where).toBe('fetch')
    expect(context.tables).toEqual(['users', 'alerts']) // transient 테이블만
    expect(context.attempt).toBe(3) // extra 병합
  })

  it('transient 항목이 없으면 아무것도 보고하지 않는다', () => {
    reportFinalFetchFailure([
      { table: 'tasks', message: 'permission denied', code: '42501', transient: false },
    ])
    reportFinalFetchFailure([])
    reportFinalFetchFailure(undefined)

    expect(reportError).not.toHaveBeenCalled()
  })

  it('첫 transient 에러의 code를 captured error에 부착한다 — Sentry fingerprint 유지', () => {
    reportFinalFetchFailure([
      { table: 'users', message: 'TimeoutError: timed out', code: '57014', transient: true },
    ])

    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError.mock.calls[0][0].code).toBe('57014')
  })
})
