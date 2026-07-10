import { describe, it, expect } from 'vitest'
import { getWorkPlansForDate, getStudentWorkPlanCounts } from './workPlans.js'

describe('getWorkPlansForDate', () => {
  const data = {
    workPlans: [
      { id: 'w1', planDate: '2026-07-11', planTime: '14:00', studentIds: [] },
      { id: 'w2', planDate: '2026-07-11', planTime: '09:30', studentIds: [] },
      { id: 'w3', planDate: '2026-07-12', planTime: '10:00', studentIds: [] },
      { id: 'w4', planDate: '2026-07-11', planTime: '', studentIds: [] },
    ],
  }

  it('해당 날짜만 시간 오름차순으로, 시간 미지정은 뒤로', () => {
    const result = getWorkPlansForDate(data, '2026-07-11')
    expect(result.map((p) => p.id)).toEqual(['w2', 'w1', 'w4'])
  })

  it('계획 없으면 빈 배열', () => {
    expect(getWorkPlansForDate({ workPlans: [] }, '2026-07-11')).toEqual([])
    expect(getWorkPlansForDate({}, '2026-07-11')).toEqual([])
  })
})

describe('getStudentWorkPlanCounts', () => {
  it('학생별 태그 횟수를 센다 (복수 학생 태그 포함)', () => {
    const data = {
      workPlans: [
        { id: 'w1', studentIds: ['s1', 's2'] },
        { id: 'w2', studentIds: ['s1'] },
        { id: 'w3', studentIds: [] },
      ],
    }
    const counts = getStudentWorkPlanCounts(data)
    expect(counts.get('s1')).toBe(2)
    expect(counts.get('s2')).toBe(1)
    expect(counts.get('s3')).toBeUndefined()
  })
})
