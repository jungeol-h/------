import { describe, it, expect } from 'vitest'
import { getStudentView, subjectBreakdown } from './studentView.js'

const baseData = {
  students: [{ id: 's1', name: '김안동' }, { id: 's2', name: '이수진' }],
  educators: [
    { id: 'e1', name: '박매니저', role: 'manager' },
    { id: 'e2', name: '최강사', role: 'instructor' },
  ],
  assignments: [
    { studentId: 's1', educatorId: 'e1' },
    { studentId: 's1', educatorId: 'e2' },
  ],
  alerts: [{ studentId: 's1', resolved: false }],
  mindRecords: [
    { id: 'm1', studentId: 's1', date: '2026-05-14' },
    { id: 'm2', studentId: 's1', date: '2026-05-16' },
    { id: 'm3', studentId: 's2', date: '2026-05-16' },
  ],
  diaryRecords: [],
  learningRecords: [
    { id: 'l1', studentId: 's1', date: '2026-05-15', subject: '수학', duration: 60 },
    { id: 'l2', studentId: 's1', date: '2026-05-16', subject: '수학', duration: 40 },
    { id: 'l3', studentId: 's1', date: '2026-05-16', subject: '영어', duration: 30 },
  ],
  tasks: [
    { id: 't1', studentId: 's1', dueDate: '2026-05-14', status: 'done' },
    { id: 't2', studentId: 's1', dueDate: '2026-05-18', status: 'pending' },
  ],
  counselingRecords: [],
  careerDesignResults: [{ id: 'c1', studentId: 's1' }],
  learningDiagnosisResults: [],
}

describe('getStudentView', () => {
  it('학생과 담당 매니저(role=manager만)를 묶는다', () => {
    const view = getStudentView(baseData, 's1')
    expect(view.student.name).toBe('김안동')
    expect(view.managers).toHaveLength(1)
    expect(view.managers[0].name).toBe('박매니저')
  })

  it('미해결 알림 여부를 반영', () => {
    expect(getStudentView(baseData, 's1').hasUnresolvedAlert).toBe(true)
    expect(getStudentView(baseData, 's2').hasUnresolvedAlert).toBe(false)
  })

  it('마인드 기록은 해당 학생만, 날짜 내림차순', () => {
    const view = getStudentView(baseData, 's1')
    expect(view.mindRecords.map((r) => r.id)).toEqual(['m2', 'm1'])
  })

  it('과제는 마감일 내림차순', () => {
    const view = getStudentView(baseData, 's1')
    expect(view.tasks.map((t) => t.id)).toEqual(['t2', 't1'])
  })

  it('진로 결과는 단일 객체 또는 null', () => {
    expect(getStudentView(baseData, 's1').careerDesignResult.id).toBe('c1')
    expect(getStudentView(baseData, 's2').careerDesignResult).toBeNull()
    expect(getStudentView(baseData, 's1').learningDiagnosisResult).toBeNull()
  })

  it('존재하지 않는 학생은 student=null', () => {
    expect(getStudentView(baseData, 'unknown').student).toBeNull()
  })
})

describe('subjectBreakdown', () => {
  it('과목별 합산 후 내림차순', () => {
    const records = [
      { subject: '수학', duration: 60 },
      { subject: '수학', duration: 40 },
      { subject: '영어', duration: 30 },
    ]
    expect(subjectBreakdown(records)).toEqual([
      { name: '수학', minutes: 100 },
      { name: '영어', minutes: 30 },
    ])
  })

  it('limit으로 상위 N개만', () => {
    const records = [
      { subject: 'A', duration: 50 },
      { subject: 'B', duration: 40 },
      { subject: 'C', duration: 30 },
    ]
    expect(subjectBreakdown(records, 2)).toHaveLength(2)
  })
})
