import { describe, it, expect } from 'vitest'
import { minutesToAngle, hhmmToMinutes, polar, sectorPath } from './clockGeometry.js'

describe('minutesToAngle', () => {
  it('자정=위(-90°), 정오=아래(90°), 6시=왼쪽 아님 오른쪽 아님 확인', () => {
    expect(minutesToAngle(0)).toBe(-90)     // 00:00 위
    expect(minutesToAngle(720)).toBe(90)    // 12:00 아래
    expect(minutesToAngle(360)).toBe(0)     // 06:00 오른쪽
    expect(minutesToAngle(1080)).toBe(180)  // 18:00 왼쪽
  })
})

describe('hhmmToMinutes', () => {
  it('HH:MM 파싱', () => {
    expect(hhmmToMinutes('00:00')).toBe(0)
    expect(hhmmToMinutes('09:30')).toBe(570)
    expect(hhmmToMinutes('23:59')).toBe(1439)
  })
  it('잘못된 값은 null', () => {
    expect(hhmmToMinutes(null)).toBeNull()
    expect(hhmmToMinutes('')).toBeNull()
    expect(hhmmToMinutes('abc')).toBeNull()
  })
})

describe('polar', () => {
  it('0°는 오른쪽, 90°는 아래', () => {
    const right = polar(0, 0, 10, 0)
    expect(right.x).toBeCloseTo(10)
    expect(right.y).toBeCloseTo(0)
    const down = polar(0, 0, 10, 90)
    expect(down.x).toBeCloseTo(0)
    expect(down.y).toBeCloseTo(10)
  })
})

describe('sectorPath', () => {
  it('일반 구간 — largeArc 0', () => {
    const path = sectorPath(100, 100, 90, 540, 600) // 09:00~10:00
    expect(path).toMatch(/^M 100 100 L /)
    expect(path).toContain('A 90 90 0 0 1')
  })

  it('12시간 초과 구간 — largeArc 1', () => {
    const path = sectorPath(100, 100, 90, 0, 800)
    expect(path).toContain('A 90 90 0 1 1')
  })

  it('자정 넘는 구간(23:00~01:00)은 +1440 보정으로 2시간 구간', () => {
    const path = sectorPath(100, 100, 90, 1380, 60)
    expect(path).toContain('A 90 90 0 0 1') // 120분 구간 → largeArc 0
    expect(path).not.toBeNull()
  })

  it('0분 구간은 null', () => {
    expect(sectorPath(100, 100, 90, 600, 600)).toBeNull()
  })
})
