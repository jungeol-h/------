import { describe, it, expect } from 'vitest'
import {
  evaluateMindLevel,
  getMindStatus,
  getRiskStudents,
} from './riskDetection.js'

// docs 기준: 합산 -6 이하 또는 단일 -4 이하 → 위험.
describe('evaluateMindLevel — 위험 등급 판정', () => {
  it('정상 점수는 null', () => {
    expect(evaluateMindLevel({ mood: 3, motivation: 2, confidence: 1 })).toBeNull()
    expect(evaluateMindLevel({ mood: 0, motivation: 0, confidence: 0 })).toBeNull()
  })

  it('합산 -5는 경계 미달 — null', () => {
    expect(evaluateMindLevel({ mood: -2, motivation: -2, confidence: -1 })).toBeNull()
  })

  it('합산 정확히 -6은 warning (경계)', () => {
    expect(evaluateMindLevel({ mood: -2, motivation: -2, confidence: -2 })).toBe('warning')
  })

  it('단일 -3은 트리거 아님 (경계)', () => {
    expect(evaluateMindLevel({ mood: -3, motivation: 0, confidence: 0 })).toBeNull()
  })

  it('단일 -4면 합산이 높아도 danger', () => {
    expect(evaluateMindLevel({ mood: -4, motivation: 5, confidence: 5 })).toBe('danger')
  })

  it('합산 -6~-8은 warning', () => {
    expect(evaluateMindLevel({ mood: -3, motivation: -3, confidence: -2 })).toBe('warning')
  })

  it('합산 정확히 -9는 danger (경계)', () => {
    expect(evaluateMindLevel({ mood: -3, motivation: -3, confidence: -3 })).toBe('danger')
  })
})

describe('getMindStatus — 최근 기록 1건 기준', () => {
  it('기록 없으면 null', () => {
    expect(getMindStatus([])).toBeNull()
    expect(getMindStatus(undefined)).toBeNull()
  })

  it('가장 최근 날짜 기록으로 판정', () => {
    const records = [
      { date: '2026-05-10', mood: -5, motivation: -5, confidence: -5 }, // 과거 danger
      { date: '2026-05-16', mood: 3, motivation: 3, confidence: 3 },    // 최근 정상
    ]
    expect(getMindStatus(records)).toBeNull()
  })

  it('최근 기록이 위험이면 위험 반환', () => {
    const records = [
      { date: '2026-05-10', mood: 3, motivation: 3, confidence: 3 },
      { date: '2026-05-16', mood: -4, motivation: -4, confidence: -4 },
    ]
    expect(getMindStatus(records)).toBe('danger')
  })
})

describe('getRiskStudents — 위험군 목록', () => {
  const data = {
    students: [
      { id: 's1', status: 'active' },   // 위험, 매니저 e1 배정
      { id: 's2', status: 'active' },   // 정상, e1 배정
      { id: 's3', status: 'active' },   // 위험, 미배정
      { id: 's4', status: 'inactive' }, // 위험이지만 비활성
    ],
    assignments: [
      { studentId: 's1', educatorId: 'e1' },
      { studentId: 's2', educatorId: 'e1' },
    ],
    mindRecords: [
      { studentId: 's1', date: '2026-05-16', mood: -4, motivation: -4, confidence: -4 },
      { studentId: 's2', date: '2026-05-16', mood: 3, motivation: 2, confidence: 1 },
      { studentId: 's3', date: '2026-05-16', mood: -2, motivation: -2, confidence: -2 },
      { studentId: 's4', date: '2026-05-16', mood: -5, motivation: -5, confidence: -5 },
    ],
  }

  it('관리자 조회(필터 없음): 미배정 학생도 위험군에 포함', () => {
    const result = getRiskStudents(data)
    const ids = result.map((r) => r.student.id)
    expect(ids).toContain('s1')
    expect(ids).toContain('s3') // 미배정도 잡힘
    expect(ids).not.toContain('s2') // 정상 제외
  })

  it('비활성 학생은 위험이어도 제외', () => {
    const result = getRiskStudents(data)
    expect(result.map((r) => r.student.id)).not.toContain('s4')
  })

  it('매니저 조회: 담당 학생만 — 미배정 학생 제외', () => {
    const result = getRiskStudents(data, { educatorId: 'e1' })
    const ids = result.map((r) => r.student.id)
    expect(ids).toContain('s1')
    expect(ids).not.toContain('s3') // 미배정 — 매니저 화면엔 안 보임
  })

  it('danger가 warning보다 앞에 정렬', () => {
    const sortData = {
      students: [
        { id: 'a', status: 'active' },
        { id: 'b', status: 'active' },
      ],
      assignments: [],
      mindRecords: [
        { studentId: 'a', date: '2026-05-16', mood: -2, motivation: -2, confidence: -2 }, // warning
        { studentId: 'b', date: '2026-05-16', mood: -5, motivation: -5, confidence: -5 }, // danger
      ],
    }
    const result = getRiskStudents(sortData)
    expect(result.map((r) => r.student.id)).toEqual(['b', 'a'])
  })
})
