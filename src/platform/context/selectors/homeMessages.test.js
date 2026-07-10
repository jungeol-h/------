import { describe, it, expect } from 'vitest'
import { getStudentHomeMessages } from './homeMessages.js'

const today = new Date('2026-07-11T12:00:00')

describe('getStudentHomeMessages', () => {
  it('데이터 없으면 빈 배열', () => {
    expect(getStudentHomeMessages({}, 's1', today)).toEqual([])
  })

  it('최근 14일 내 followUp 있는 최신 상담 1건만 coach로', () => {
    const data = {
      counselingRecords: [
        { id: 'c1', studentId: 's1', date: '2026-07-01', followUp: '단어장 매일 확인' },
        { id: 'c2', studentId: 's1', date: '2026-07-08', followUp: '수학 오답노트 지참' },
        { id: 'c3', studentId: 's1', date: '2026-06-01', followUp: '오래된 조치' },
        { id: 'c4', studentId: 's1', date: '2026-07-10', followUp: '' },
        { id: 'c5', studentId: 's2', date: '2026-07-10', followUp: '남의 것' },
      ],
    }
    const msgs = getStudentHomeMessages(data, 's1', today)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].kind).toBe('coach')
    expect(msgs[0].text).toBe('수학 오답노트 지참')
  })

  it('마감 오늘/내일 미완료 과제만 최대 2건', () => {
    const data = {
      tasks: [
        { id: 't1', studentId: 's1', title: 'A', dueDate: '2026-07-11', status: 'pending' },
        { id: 't2', studentId: 's1', title: 'B', dueDate: '2026-07-12', status: 'pending' },
        { id: 't3', studentId: 's1', title: 'C', dueDate: '2026-07-12', status: 'pending' },
        { id: 't4', studentId: 's1', title: '완료됨', dueDate: '2026-07-11', status: 'done' },
        { id: 't5', studentId: 's1', title: '먼 미래', dueDate: '2026-07-20', status: 'pending' },
      ],
    }
    const msgs = getStudentHomeMessages(data, 's1', today)
    expect(msgs.filter((m) => m.kind === 'task')).toHaveLength(2)
    expect(msgs[0].text).toContain('오늘 마감')
  })

  it('오늘/내일 업무계획에 태그되면 schedule 메시지', () => {
    const data = {
      workPlans: [
        { id: 'w1', planDate: '2026-07-11', planTime: '15:00', types: ['career_path'], studentIds: ['s1'] },
        { id: 'w2', planDate: '2026-07-13', planTime: '', types: ['etc'], studentIds: ['s1'] },
        { id: 'w3', planDate: '2026-07-11', planTime: '', types: ['etc'], studentIds: ['s2'] },
      ],
    }
    const msgs = getStudentHomeMessages(data, 's1', today)
    expect(msgs).toHaveLength(1)
    expect(msgs[0].kind).toBe('schedule')
    expect(msgs[0].text).toContain('오늘 15:00에 진로진학')
  })

  it('전체 합쳐 최대 4건', () => {
    const data = {
      counselingRecords: [{ id: 'c1', studentId: 's1', date: '2026-07-10', followUp: '조치' }],
      tasks: [
        { id: 't1', studentId: 's1', title: 'A', dueDate: '2026-07-11', status: 'pending' },
        { id: 't2', studentId: 's1', title: 'B', dueDate: '2026-07-11', status: 'pending' },
      ],
      workPlans: [
        { id: 'w1', planDate: '2026-07-11', planTime: '', types: [], studentIds: ['s1'] },
        { id: 'w2', planDate: '2026-07-12', planTime: '', types: [], studentIds: ['s1'] },
      ],
    }
    expect(getStudentHomeMessages(data, 's1', today)).toHaveLength(4)
  })
})
