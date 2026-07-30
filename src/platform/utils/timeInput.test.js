import { describe, expect, it } from 'vitest'
import { parseTimeInput } from './timeInput.js'

describe('parseTimeInput', () => {
  it('숫자만 입력 — 시 단독', () => {
    expect(parseTimeInput('9')).toBe('09:00')
    expect(parseTimeInput('13')).toBe('13:00')
    expect(parseTimeInput('20')).toBe('20:00') // 버그 재현 케이스: 20이 02가 되면 안 된다
    expect(parseTimeInput('0')).toBe('00:00')
    expect(parseTimeInput('23')).toBe('23:00')
  })

  it('숫자만 입력 — 시+분 붙여쓰기', () => {
    expect(parseTimeInput('930')).toBe('09:30')
    expect(parseTimeInput('1330')).toBe('13:30')
    expect(parseTimeInput('2015')).toBe('20:15')
  })

  it('구분자 표기', () => {
    expect(parseTimeInput('13:30')).toBe('13:30')
    expect(parseTimeInput('13.30')).toBe('13:30')
    expect(parseTimeInput('13 30')).toBe('13:30')
    expect(parseTimeInput('9:5')).toBe('09:05')
  })

  it('한국어 시·분 표기', () => {
    expect(parseTimeInput('13시')).toBe('13:00')
    expect(parseTimeInput('1시30분')).toBe('01:30')
    expect(parseTimeInput('13시 30분')).toBe('13:30')
  })

  it('오전/오후·am/pm', () => {
    expect(parseTimeInput('오후 1')).toBe('13:00')
    expect(parseTimeInput('오후 1:30')).toBe('13:30')
    expect(parseTimeInput('오전 9')).toBe('09:00')
    expect(parseTimeInput('pm 8')).toBe('20:00')
    expect(parseTimeInput('8 pm')).toBe('20:00')
    expect(parseTimeInput('8pm')).toBe('20:00')
    expect(parseTimeInput('오후1130')).toBe('23:30')
  })

  it('정오·자정 경계', () => {
    expect(parseTimeInput('오전 12')).toBe('00:00')
    expect(parseTimeInput('오후 12')).toBe('12:00')
    expect(parseTimeInput('12')).toBe('12:00')
  })

  it('오후 + 24시간제 시각은 거부하지 않고 12 이하만 허용', () => {
    expect(parseTimeInput('오후 13')).toBeNull()
    expect(parseTimeInput('오전 20')).toBeNull()
  })

  it('해석 불가 입력', () => {
    expect(parseTimeInput('')).toBeNull()
    expect(parseTimeInput('  ')).toBeNull()
    expect(parseTimeInput('24')).toBeNull()
    expect(parseTimeInput('25:00')).toBeNull()
    expect(parseTimeInput('13:60')).toBeNull()
    expect(parseTimeInput('abc')).toBeNull()
    expect(parseTimeInput('13:30:00')).toBeNull()
    expect(parseTimeInput('12345')).toBeNull()
  })
})
