import { describe, it, expect } from 'vitest'
import { canViewByGroups, canViewRecordGroup } from './groupScope.js'

describe('canViewByGroups', () => {
  it('열람자 그룹이 없으면(null/빈 배열) 전체 열람', () => {
    expect(canViewByGroups(null, ['안동NAVI'])).toBe(true)
    expect(canViewByGroups(undefined, ['안동NAVI'])).toBe(true)
    expect(canViewByGroups([], ['안동NAVI'])).toBe(true)
  })

  it('대상 그룹이 없으면 공용 — 누구에게나 보임', () => {
    expect(canViewByGroups(['안동NAVI'], null)).toBe(true)
    expect(canViewByGroups(['안동NAVI'], [])).toBe(true)
  })

  it('교집합이 있으면 보임', () => {
    expect(canViewByGroups(['안동NAVI'], ['안동NAVI'])).toBe(true)
    expect(canViewByGroups(['안동NAVI', '깨알'], ['산청우정학사', '깨알'])).toBe(true)
  })

  it('교집합이 없으면 안 보임', () => {
    expect(canViewByGroups(['안동NAVI'], ['산청우정학사'])).toBe(false)
    expect(canViewByGroups(['깨알'], ['산청우정학사', '안동NAVI'])).toBe(false)
  })
})

describe('canViewRecordGroup', () => {
  it('열람자 그룹이 없으면 전체 열람', () => {
    expect(canViewRecordGroup(null, '산청우정학사')).toBe(true)
    expect(canViewRecordGroup([], '산청우정학사')).toBe(true)
  })

  it('기록 그룹이 null/빈 문자열이면 공용', () => {
    expect(canViewRecordGroup(['안동NAVI'], null)).toBe(true)
    expect(canViewRecordGroup(['안동NAVI'], '')).toBe(true)
  })

  it('소속 그룹의 기록만 보임', () => {
    expect(canViewRecordGroup(['안동NAVI'], '안동NAVI')).toBe(true)
    expect(canViewRecordGroup(['안동NAVI'], '산청우정학사')).toBe(false)
  })
})
