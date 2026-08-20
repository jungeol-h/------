import { describe, it, expect } from 'vitest'
import { EDUCATOR_DUTIES, hasMultipleDuties, dutyOfType } from './educatorDuties.js'

describe('educatorDuties', () => {
  it('황광희(a-hwang)는 국어·진로진학컨설팅 복수 담당', () => {
    expect(hasMultipleDuties('a-hwang')).toBe(true)
    expect(EDUCATOR_DUTIES['a-hwang'].map((d) => d.label)).toEqual(['국어', '진로진학컨설팅'])
  })

  it('단일 담당·미등록 교직원은 복수 담당이 아니다', () => {
    expect(hasMultipleDuties('t02')).toBe(false)
    expect(hasMultipleDuties(undefined)).toBe(false)
  })

  it('dutyOfType — 신·구 체계 유형을 해당 업무로 매핑', () => {
    expect(dutyOfType('a-hwang', 'subject_learning')?.key).toBe('korean')
    expect(dutyOfType('a-hwang', 'study')?.key).toBe('korean')
    expect(dutyOfType('a-hwang', 'career_path')?.key).toBe('career')
    expect(dutyOfType('a-hwang', 'career')?.key).toBe('career')
    expect(dutyOfType('a-hwang', 'assessment')?.key).toBe('career')
  })

  it('dutyOfType — 자기주도학습코칭 등 duty 밖 유형은 null(보고서 미포함)', () => {
    expect(dutyOfType('a-hwang', 'self_directed')).toBeNull()
    expect(dutyOfType('a-hwang', 'etc')).toBeNull()
    expect(dutyOfType('t02', 'subject_learning')).toBeNull()
  })

  it('duty.type(보고서 필터 대표 유형)은 duty.types에 포함된다', () => {
    for (const duties of Object.values(EDUCATOR_DUTIES)) {
      for (const d of duties) expect(d.types).toContain(d.type)
    }
  })
})
