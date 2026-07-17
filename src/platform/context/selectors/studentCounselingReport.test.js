import { describe, it, expect } from 'vitest'
import {
  blockCodesFor,
  formatScheduleBlocks,
  buildStudentCounselingEntries,
} from './studentCounselingReport.js'

describe('blockCodesFor', () => {
  it('블록 하나와 정확히 일치', () => {
    expect(blockCodesFor(1, '16:00', '17:50')).toEqual(['M1'])
    expect(blockCodesFor(1, '17:00', '18:50')).toEqual(['M2'])
    expect(blockCodesFor(6, '12:30', '14:30')).toEqual(['SA1'])
  })

  it('여러 블록에 걸치면 겹침 없이 순서대로 타일링', () => {
    expect(blockCodesFor(1, '16:00', '20:50')).toEqual(['M1', 'M3'])
    expect(blockCodesFor(6, '12:30', '16:45')).toEqual(['SA1', 'SA3'])
    expect(blockCodesFor(0, '12:30', '19:00')).toEqual(['SU1', 'SU3', 'SU5'])
  })

  it('시작 시각이 조금 어긋나도 -30분 허용 오차로 매칭', () => {
    expect(blockCodesFor(1, '16:20', '17:50')).toEqual(['M1'])
  })

  it('블록 없는 요일(수·목)·파싱 실패는 빈 배열', () => {
    expect(blockCodesFor(3, '16:00', '17:50')).toEqual([])
    expect(blockCodesFor(1, '', '17:50')).toEqual([])
  })
})

describe('formatScheduleBlocks', () => {
  it('요일 월~일 순으로 기호 나열', () => {
    const schedules = [
      { dayOfWeek: 6, arrivalTime: '12:30', departureTime: '14:30' },
      { dayOfWeek: 1, arrivalTime: '16:00', departureTime: '20:50' },
      { dayOfWeek: 2, arrivalTime: '17:00', departureTime: '18:50' },
    ]
    expect(formatScheduleBlocks(schedules)).toBe('M1 M3 · T2 · SA1')
  })

  it('블록 매칭 실패 요일은 원문 시간 폴백', () => {
    const schedules = [{ dayOfWeek: 3, arrivalTime: '16:00', departureTime: '18:00' }]
    expect(formatScheduleBlocks(schedules)).toBe('수 16:00~18:00')
  })

  it('빈 일정이면 빈 문자열', () => {
    expect(formatScheduleBlocks([])).toBe('')
    expect(formatScheduleBlocks(undefined)).toBe('')
  })
})

describe('buildStudentCounselingEntries', () => {
  const base = {
    topic: '진로', diagnosis: '진단', advice: '조언', followUp: '후속', note: '',
    educatorName: '황광희(진로)', typeLabel: '진로진학',
  }

  it('날짜 오름차순 통산 회차 + 조회기간', () => {
    const records = [
      { id: 'r2', date: '2026-07-04', startTime: '14:00', endTime: '14:20', ...base },
      { id: 'r1', date: '2026-05-10', ...base },
    ]
    const { entries, totalCount, periodText } = buildStudentCounselingEntries(records)
    expect(totalCount).toBe(2)
    expect(entries.map((e) => e.cumulativeText)).toEqual(['1회차', '2회차'])
    expect(entries[0].dateTimeText).toBe('2026. 5. 10.(일)')
    expect(entries[1].dateTimeText).toBe('2026. 7. 4.(토) pm 2:00 ~ pm 2:20 (20분)')
    expect(periodText).toBe('2026. 5. 10.(일) ~ 2026. 7. 4.(토)')
  })

  it('기록 1건이면 조회기간은 단일 날짜', () => {
    const { periodText } = buildStudentCounselingEntries([{ id: 'r1', date: '2026-07-04', ...base }])
    expect(periodText).toBe('2026. 7. 4.(토)')
  })

  it('비구조화 구 기록은 fallbackContent 전문 경로', () => {
    const records = [{
      id: 'r1', date: '2026-07-04',
      topic: '', diagnosis: '', advice: '', followUp: '', note: '',
      educatorName: '황광희(진로)', typeLabel: '학습',
      fallbackContent: '단일 텍스트 상담 내용',
    }]
    const { entries } = buildStudentCounselingEntries(records)
    expect(entries[0].fallbackContent).toBe('단일 텍스트 상담 내용')
  })

  it('빈 records 방어', () => {
    expect(buildStudentCounselingEntries([])).toEqual({ entries: [], totalCount: 0, periodText: '-' })
  })
})
