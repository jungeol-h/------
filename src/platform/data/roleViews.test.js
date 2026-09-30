import { describe, it, expect } from 'vitest'
import { EDUCATOR_VIEWS, educatorViewOf, applyRoleView } from './roleViews.js'

const hwang = { id: 'a-hwang', name: '황광희', role: 'admin' }
const other = { id: 't02', name: '강사', role: 'instructor' }

describe('roleViews', () => {
  it('a-hwang·test-admin은 강사 화면 전환 가능 계정', () => {
    expect(educatorViewOf(hwang)).toEqual({ role: 'instructor', extraTabs: ['external'] })
    expect(educatorViewOf({ id: 'test-admin' })).toBe(EDUCATOR_VIEWS['test-admin'])
  })

  it('미등록 계정·null은 null', () => {
    expect(educatorViewOf(other)).toBeNull()
    expect(educatorViewOf(null)).toBeNull()
    expect(educatorViewOf(undefined)).toBeNull()
  })

  it('educator 모드 — role만 강사로 덮고 accountRole·extraTabs를 싣는다', () => {
    const v = applyRoleView(hwang, 'educator')
    expect(v.role).toBe('instructor')
    expect(v.accountRole).toBe('admin')
    expect(v.educatorExtraTabs).toEqual(['external'])
    expect(v.id).toBe('a-hwang')
  })

  it('account 모드 — 같은 객체(참조 동일)', () => {
    expect(applyRoleView(hwang, 'account')).toBe(hwang)
  })

  it('미등록 계정은 educator 모드여도 원본 그대로', () => {
    expect(applyRoleView(other, 'educator')).toBe(other)
  })

  it('원본 객체를 변형하지 않는다', () => {
    applyRoleView(hwang, 'educator')
    expect(hwang).toEqual({ id: 'a-hwang', name: '황광희', role: 'admin' })
  })

  it('null user는 null 그대로', () => {
    expect(applyRoleView(null, 'educator')).toBeNull()
    expect(applyRoleView(null, 'account')).toBeNull()
  })
})
