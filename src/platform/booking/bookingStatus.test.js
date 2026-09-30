import { describe, it, expect } from 'vitest'
import { canWriteRecord, isAutoMarked, recordState } from './bookingStatus.js'

const slot = { date: '2026-09-29', startTime: '16:00', endTime: '16:20' }
const at = (iso) => new Date(iso)
const res = (over = {}) => ({ status: 'confirmed', attendanceStatus: 'pending', attendanceMarkedBy: null, ...over })

describe('canWriteRecord', () => {
  it('참석 처리된 예약은 작성 가능', () => {
    expect(canWriteRecord(res({ attendanceStatus: 'attended' }), slot, at('2026-09-29T10:00:00'))).toBe(true)
  })
  it('출결 미처리는 시작 시각이 지난 뒤에만 작성 가능', () => {
    expect(canWriteRecord(res(), slot, at('2026-09-29T15:59:00'))).toBe(false)
    expect(canWriteRecord(res(), slot, at('2026-09-29T16:00:00'))).toBe(true)
  })
  it('미참석·취소 예약과 슬롯 없는 예약은 불가', () => {
    expect(canWriteRecord(res({ attendanceStatus: 'absent' }), slot, at('2026-09-30T10:00:00'))).toBe(false)
    expect(canWriteRecord(res({ status: 'cancelled' }), slot, at('2026-09-30T10:00:00'))).toBe(false)
    expect(canWriteRecord(res(), null, at('2026-09-30T10:00:00'))).toBe(false)
  })
})

describe('recordState — 자동 처리분', () => {
  const auto = res({ attendanceStatus: 'attended', attendanceMarkedBy: 'system' })
  it('자동 참석 + 예약 상담기록 없음 → 작성 대상 아님 (독촉하지 않음)', () => {
    expect(isAutoMarked(auto)).toBe(true)
    expect(recordState(auto, undefined, '2026-09-01', '2026-09-30')).toBe('not_required')
  })
  it('자동 참석이어도 기록이 있으면 기록 상태를 따른다', () => {
    expect(recordState(auto, { status: 'draft' }, '2026-09-29', '2026-09-30')).toBe('draft')
  })
  it('사람이 참석 처리한 건은 종전대로 기한 판정', () => {
    const manual = res({ attendanceStatus: 'attended', attendanceMarkedBy: 't01' })
    expect(isAutoMarked(manual)).toBe(false)
    expect(recordState(manual, undefined, '2026-09-01', '2026-09-30')).toBe('overdue')
  })
})
