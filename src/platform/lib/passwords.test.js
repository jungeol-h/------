import { describe, it, expect } from 'vitest'
import {
  hashPassword, verifyOrPlaintext, isHashed, validateNewPassword,
  INITIAL_COST, PASSWORD_MIN_LENGTH,
} from './passwords.js'

describe('isHashed', () => {
  it('bcrypt 해시 형식을 판별한다', () => {
    expect(isHashed('$2b$10$abcdefghijklmnopqrstuv')).toBe(true)
    expect(isHashed('$2a$08$abcdefghijklmnopqrstuv')).toBe(true)
    expect(isHashed('01012345678')).toBe(false) // 평문(전화번호)
    expect(isHashed('')).toBe(false)
    expect(isHashed(null)).toBe(false)
  })
})

describe('hashPassword + verifyOrPlaintext', () => {
  it('해시 저장값은 bcrypt 비교로 검증된다', async () => {
    const hash = await hashPassword('내비밀번호123', INITIAL_COST)
    expect(isHashed(hash)).toBe(true)
    expect(await verifyOrPlaintext('내비밀번호123', hash)).toEqual({ ok: true, wasPlaintext: false })
    expect(await verifyOrPlaintext('틀린비밀번호', hash)).toEqual({ ok: false, wasPlaintext: false })
  })

  it('평문 저장값(미전환 계정)은 문자열 비교 + wasPlaintext 표시', async () => {
    expect(await verifyOrPlaintext('01012345678', '01012345678')).toEqual({ ok: true, wasPlaintext: true })
    expect(await verifyOrPlaintext('01000000000', '01012345678')).toEqual({ ok: false, wasPlaintext: true })
  })

  it('저장값이 없으면 실패', async () => {
    expect((await verifyOrPlaintext('anything', '')).ok).toBe(false)
    expect((await verifyOrPlaintext('anything', null)).ok).toBe(false)
  })
})

describe('validateNewPassword', () => {
  it(`${PASSWORD_MIN_LENGTH}자 미만 거부`, () => {
    expect(validateNewPassword('1234567')).toMatch(/이상/)
    expect(validateNewPassword('12345678')).toBeNull()
  })

  it('공백 포함 거부', () => {
    expect(validateNewPassword('pass word1')).toMatch(/공백/)
  })

  it('금지 목록(초기값=전화번호)과 동일하면 거부', () => {
    expect(validateNewPassword('01012345678', { forbidden: ['01012345678'] })).toMatch(/전화번호/)
    expect(validateNewPassword('01012345678', { forbidden: ['01099998888', null] })).toBeNull()
  })
})
