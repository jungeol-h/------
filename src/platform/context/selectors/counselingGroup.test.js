import { describe, it, expect } from 'vitest'
import {
  counselingGroupKey, findCounselingGroupSiblings, buildCounselingGroupSizes,
} from './counselingGroup.js'

const base = {
  educatorId: 'e1', date: '2026-10-01', type: 'study', targetType: 'student',
  startTime: '14:00', endTime: '14:30', topic: 't', diagnosis: 'd', advice: 'a',
  followUp: 'f', note: 'n', nextAppointment: '', comment: 'c',
  attachments: [{ path: 'p/1.pdf' }, { path: 'p/2.pdf' }],
}
const rec = (id, studentId, over = {}) => ({ ...base, id, studentId, ...over })

describe('counselingGroupKey', () => {
  it('내용이 같으면 학생이 달라도 같은 키', () => {
    expect(counselingGroupKey(rec('1', 's1'))).toBe(counselingGroupKey(rec('2', 's2')))
  })
  it('필드 하나가 다르면 다른 키', () => {
    expect(counselingGroupKey(rec('1', 's1'))).not.toBe(counselingGroupKey(rec('2', 's2', { advice: 'x' })))
  })
  it('시간이 다르면 다른 키', () => {
    expect(counselingGroupKey(rec('1', 's1'))).not.toBe(counselingGroupKey(rec('2', 's2', { endTime: '15:00' })))
  })
  it('첨부가 다르면 다른 키', () => {
    expect(counselingGroupKey(rec('1', 's1'))).not.toBe(
      counselingGroupKey(rec('2', 's2', { attachments: [{ path: 'p/1.pdf' }] })))
  })
  it('첨부 순서가 달라도 같은 키', () => {
    const rev = [{ path: 'p/2.pdf' }, { path: 'p/1.pdf' }]
    expect(counselingGroupKey(rec('1', 's1'))).toBe(counselingGroupKey(rec('2', 's2', { attachments: rev })))
  })
  it('예약 유래(source)는 null', () => {
    expect(counselingGroupKey(rec('1', 's1', { source: 'booking' }))).toBeNull()
  })
  it('null/undefined/빈문자열은 동일 취급', () => {
    const a = rec('1', 's1', { note: null, nextAppointment: undefined })
    const b = rec('2', 's2', { note: '', nextAppointment: '' })
    expect(counselingGroupKey(a)).toBe(counselingGroupKey(b))
  })
})

describe('findCounselingGroupSiblings', () => {
  it('같은 그룹의 다른 학생 기록만 반환', () => {
    const a = rec('1', 's1')
    const all = [a, rec('2', 's2'), rec('3', 's3'), rec('4', 's4', { topic: 'other' })]
    expect(findCounselingGroupSiblings(a, all).map((r) => r.id)).toEqual(['2', '3'])
  })
  it('같은 학생의 중복행은 제외, 형제 학생당 첫 건만', () => {
    const a = rec('1', 's1')
    const all = [a, rec('2', 's1'), rec('3', 's2'), rec('4', 's2')]
    expect(findCounselingGroupSiblings(a, all).map((r) => r.id)).toEqual(['3'])
  })
  it('예약 유래·falsy·records 없음은 []', () => {
    const b = rec('1', 's1', { source: 'booking' })
    expect(findCounselingGroupSiblings(b, [b, rec('2', 's2')])).toEqual([])
    expect(findCounselingGroupSiblings(null, [])).toEqual([])
    expect(findCounselingGroupSiblings(rec('1', 's1'), undefined)).toEqual([])
  })
})

describe('buildCounselingGroupSizes', () => {
  it('서로 다른 학생 수로 센다 (중복행·예약행 제외)', () => {
    const all = [
      rec('1', 's1'), rec('2', 's2'), rec('3', 's2'), rec('4', 's3'),
      rec('5', 's9', { source: 'booking' }), rec('6', 's5', { topic: 'solo' }),
    ]
    const sizes = buildCounselingGroupSizes(all)
    expect(sizes.get(counselingGroupKey(all[0]))).toBe(3)
    expect(sizes.get(counselingGroupKey(all[5]))).toBe(1)
    expect(sizes.size).toBe(2)
    expect(buildCounselingGroupSizes(undefined).size).toBe(0)
  })
})
