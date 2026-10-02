import { describe, it, expect } from 'vitest'
import { buildStudentListRows, statusDatesOf, STUDENT_LIST_COLUMNS } from './studentListExcel.js'

const col = (name) => STUDENT_LIST_COLUMNS.indexOf(name)

describe('statusDatesOf', () => {
  it('현재 상태와 일치하는 처리일만 반환한다', () => {
    expect(statusDatesOf({ status: 'withdrawn', withdrawnAt: '2026-09-01', cancelledAt: '2026-08-01' }))
      .toEqual({ withdrawnAt: '2026-09-01', cancelledAt: '' })
    expect(statusDatesOf({ status: 'cancelled', withdrawnAt: '2026-09-01', cancelledAt: '2026-08-01' }))
      .toEqual({ withdrawnAt: '', cancelledAt: '2026-08-01' })
  })

  it('재원 복구된 학생은 남아있는 옛 날짜를 숨긴다', () => {
    expect(statusDatesOf({ status: 'active', withdrawnAt: '2026-09-01' }))
      .toEqual({ withdrawnAt: '', cancelledAt: '' })
    expect(statusDatesOf({ withdrawnAt: '2026-09-01' }))
      .toEqual({ withdrawnAt: '', cancelledAt: '' })
  })

  it('구 상태 inactive는 퇴원일 열에 표시한다', () => {
    expect(statusDatesOf({ status: 'inactive', withdrawnAt: '2026-07-01' }).withdrawnAt).toBe('2026-07-01')
  })
})

describe('buildStudentListRows', () => {
  const students = [
    { id: 's1', name: '김재원', gender: 'M', groups: ['NAVI 4기'], school: 'A고', grade: '2', status: 'active', enrolledAt: '2026-03-02', riskLevel: 'warning', selfIndex: 70 },
    { id: 's2', name: '이퇴원', gender: 'F', groups: [], status: 'withdrawn', enrolledAt: '2026-03-02', withdrawnAt: '2026-09-15' },
    { id: 's3', name: '박취소', status: 'cancelled', cancelledAt: '2026-09-20' },
  ]
  const managerNameOf = (id) => (id === 's1' ? '최매니저' : '')
  const rows = buildStudentListRows(students, managerNameOf)

  it('열 수와 순번이 맞다', () => {
    expect(rows).toHaveLength(3)
    rows.forEach((r, i) => {
      expect(r).toHaveLength(STUDENT_LIST_COLUMNS.length)
      expect(r[col('순번')]).toBe(i + 1)
    })
  })

  it('상태·입학일·퇴원일·신청취소일을 표시한다', () => {
    expect(rows[0][col('상태')]).toBe('재원')
    expect(rows[0][col('입학일')]).toBe('2026-03-02')
    expect(rows[1][col('상태')]).toBe('퇴원')
    expect(rows[1][col('퇴원일')]).toBe('2026-09-15')
    expect(rows[1][col('신청취소일')]).toBe('')
    expect(rows[2][col('상태')]).toBe('신청취소')
    expect(rows[2][col('신청취소일')]).toBe('2026-09-20')
  })

  it('매니저 미배정·무소속·위험도 기본값을 채운다', () => {
    expect(rows[0][col('담당 매니저')]).toBe('최매니저')
    expect(rows[1][col('담당 매니저')]).toBe('미배정')
    expect(rows[1][col('소속 그룹')]).toBe('무소속')
    expect(rows[0][col('위험도')]).toBe('주의')
    expect(rows[1][col('위험도')]).toBe('정상')
  })
})
