import { describe, it, expect } from 'vitest'
import { buildCenterHoursSheets } from './centerHoursExcel.js'
import { selectionToEntries, summarizeDays } from './centerHoursSelection.js'
import {
  CENTER_HOUR_UNITS, CENTER_WEEK_ORDER, DEFAULT_OPERATING_DAYS, operatingDayOrder, unitKey,
} from '../data/centerHours.js'

const students = [
  { id: 's1', name: '김하나', school: '안동중', grade: '중2' },
  { id: 's2', name: '박둘', school: '길주중', grade: '중1' },
  { id: 's3', name: '가나다', school: '경덕중', grade: '중2' },
]

describe('buildCenterHoursSheets', () => {
  it('요일 시트를 월·화·금·토·일 순서로 만들고 단위별 명단을 채운다', () => {
    const registrations = [
      { studentId: 's1', dayOfWeek: 1, startTime: '16:00' },
      { studentId: 's2', dayOfWeek: 1, startTime: '16:00' },
      { studentId: 's1', dayOfWeek: 6, startTime: '12:30' },
    ]
    const sheets = buildCenterHoursSheets({ registrations, students })

    expect(sheets.map((s) => s.name)).toEqual(['월요일', '화요일', '금요일', '토요일', '일요일'])
    const mon = sheets[0]
    expect(mon.units[0].label).toBe('16:00~17:00')
    expect(mon.units[0].count).toBe(2)
    // 학년(중1) 우선, 이후 이름 가나다순
    expect(mon.units[0].entries.map((e) => e.name)).toEqual(['박둘', '김하나'])
    expect(mon.units[0].entries[0].meta).toBe('길주중 중1')
    // 등록 없는 단위는 빈 명단
    expect(mon.units[1].entries).toEqual([])
    const sat = sheets[3]
    expect(sat.units[0].count).toBe(1)
  })

  it('같은 학년은 이름 가나다순으로 정렬한다', () => {
    const registrations = [
      { studentId: 's1', dayOfWeek: 2, startTime: '17:00' },
      { studentId: 's3', dayOfWeek: 2, startTime: '17:00' },
    ]
    const sheets = buildCenterHoursSheets({ registrations, students })
    const tue = sheets.find((s) => s.name === '화요일')
    expect(tue.units[1].entries.map((e) => e.name)).toEqual(['가나다', '김하나'])
  })

  it('명단에 없는 학생(탈퇴 등)의 등록은 제외한다', () => {
    const registrations = [{ studentId: 'ghost', dayOfWeek: 1, startTime: '16:00' }]
    const sheets = buildCenterHoursSheets({ registrations, students })
    expect(sheets[0].units[0].count).toBe(0)
  })
})

describe('selectionToEntries', () => {
  it('선택 집합을 요일·시간 정렬된 entries로 변환하고 end를 단위 정의에서 채운다', () => {
    const selected = new Set([
      unitKey(6, '18:00'),
      unitKey(1, '21:00'),
      unitKey(1, '16:00'),
    ])
    expect(selectionToEntries(selected)).toEqual([
      { day: 1, start: '16:00', end: '17:00' },
      { day: 1, start: '21:00', end: '21:50' }, // 주중 마지막 단위는 50분
      { day: 6, start: '18:00', end: '19:00' },
    ])
  })

  it('빈 선택은 빈 배열', () => {
    expect(selectionToEntries(new Set())).toEqual([])
  })
})

describe('summarizeDays', () => {
  it('요일별 첫 시작~마지막 끝을 요약한다 (중간에 비어도 무관)', () => {
    const selected = new Set([
      unitKey(0, '12:30'),
      unitKey(0, '17:00'), // 13:30~16:45는 선택 안 함
    ])
    expect(summarizeDays(selected)).toEqual([
      { day: 0, arrival: '12:30', departure: '18:00' },
    ])
  })

  it('선택 없는 요일은 요약에서 빠진다', () => {
    expect(summarizeDays(new Set([unitKey(5, '20:00')]))).toEqual([
      { day: 5, arrival: '20:00', departure: '21:00' },
    ])
  })
})

describe('CENTER_HOUR_UNITS 정의 자체 점검', () => {
  it('7일 전부 단위가 정의되고 각 요일 6단위, 단위는 시간 순', () => {
    expect(CENTER_WEEK_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0])
    for (const day of CENTER_WEEK_ORDER) {
      const units = CENTER_HOUR_UNITS[day]
      expect(units).toHaveLength(6)
      for (let i = 1; i < units.length; i++) {
        expect(units[i].start >= units[i - 1].end).toBe(true)
      }
      for (const u of units) expect(u.end > u.start).toBe(true)
    }
  })
})

describe('operatingDayOrder', () => {
  it('기본 운영 요일은 월·화·금·토·일 순서로 정렬된다', () => {
    expect(operatingDayOrder(DEFAULT_OPERATING_DAYS)).toEqual([1, 2, 5, 6, 0])
  })

  it('수·목을 추가하면 월~일 표시 순서를 지킨다', () => {
    expect(operatingDayOrder([0, 6, 5, 4, 3, 2, 1])).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('잘못된 값·빈 배열은 기본 운영 요일로 대체한다', () => {
    expect(operatingDayOrder([])).toEqual([1, 2, 5, 6, 0])
    expect(operatingDayOrder(null)).toEqual([1, 2, 5, 6, 0])
    expect(operatingDayOrder([7, 9])).toEqual([1, 2, 5, 6, 0])
  })
})
