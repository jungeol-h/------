import { describe, it, expect } from 'vitest'
import { findDuplicateStudents, describeDuplicate } from './studentDedup.js'

// 2026-07 실제 중복 사고 5쌍을 축약한 기존 학생 목록 (퇴원·취소 포함)
const students = [
  { id: 's1', role: 'student', name: '강은성', school: '안동여중', grade: '중2', phone: '01020401766', parentPhone: '01020471766', status: 'withdrawn' },
  { id: 's2', role: 'student', name: '김다인', school: '단성중', grade: '중3', phone: '01084355192', parentPhone: '01026315192', status: 'active' },
  { id: 's3', role: 'student', name: '하정진', school: '단성중', grade: '중2', phone: '01063125473', parentPhone: '01063695875', status: 'active' },
  { id: 's4', role: 'student', name: '박민준', school: '단성중', grade: '중1', phone: '01074631248', parentPhone: '01051971248', status: 'active' },
]

describe('findDuplicateStudents', () => {
  it('이름이 달라도(오타) 학생 전화번호가 같으면 동일인 유력으로 잡는다', () => {
    const res = findDuplicateStudents(students, { name: '김다민', phone: '01084355192', parentPhone: '' })
    expect(res).toHaveLength(1)
    expect(res[0].student.id).toBe('s2')
    expect(res[0].samePerson).toBe(true)
    expect(res[0].reasons).toContain('학생 전화번호 일치')
  })

  it('퇴원(withdrawn) 계정과 이름+학부모 번호가 같으면 동일인 유력', () => {
    const res = findDuplicateStudents(students, { name: '강은성', phone: '01040201766', parentPhone: '01020471766' })
    expect(res[0].samePerson).toBe(true)
    expect(res[0].student.status).toBe('withdrawn')
  })

  it('이름만 같으면 동명이인 가능 — samePerson=false 경고만', () => {
    const res = findDuplicateStudents(students, { name: '하정진', phone: '01041008038', parentPhone: '01099998038' })
    expect(res).toHaveLength(1)
    expect(res[0].samePerson).toBe(false)
  })

  it('학부모 번호만 같으면 형제자매 가능 — samePerson=false', () => {
    const res = findDuplicateStudents(students, { name: '박민서', phone: '01066291248', parentPhone: '01051971248' })
    expect(res).toHaveLength(1)
    expect(res[0].student.id).toBe('s4')
    expect(res[0].samePerson).toBe(false)
  })

  it('겹치는 게 없으면 빈 배열, excludeId(수정 모드)는 자기 자신 제외', () => {
    expect(findDuplicateStudents(students, { name: '없는이름', phone: '01000000001', parentPhone: '' })).toHaveLength(0)
    expect(
      findDuplicateStudents(students, { name: '김다인', phone: '01084355192', excludeId: 's2' })
    ).toHaveLength(0)
  })

  it('자리표시 비밀번호(00000000000)는 번호 비교에서 제외한다', () => {
    const withPlaceholder = [...students, { id: 's9', role: 'student', name: '이몽룡', phone: '00000000000', parentPhone: '', status: 'active' }]
    const res = findDuplicateStudents(withPlaceholder, { name: '성춘향', phone: '00000000000', parentPhone: '' })
    expect(res).toHaveLength(0)
  })

  it('동일인 유력 매치를 앞에 정렬한다', () => {
    const res = findDuplicateStudents(students, { name: '하정진', phone: '01084355192', parentPhone: '' })
    expect(res[0].student.id).toBe('s2') // 전화번호 일치가 이름 일치보다 앞
    expect(res[1].student.id).toBe('s3')
  })
})

describe('describeDuplicate', () => {
  it('학교·학년·상태 라벨·근거를 한 줄로 요약한다', () => {
    const [m] = findDuplicateStudents(students, { name: '강은성', phone: '01020401766' })
    expect(describeDuplicate(m)).toBe('강은성 · 안동여중 중2 · 퇴원 — 학생 전화번호 일치, 이름 일치')
  })
})
