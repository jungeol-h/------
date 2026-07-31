import { describe, it, expect } from 'vitest'
import { buildReservationSheets } from './reservationExcel.js'

const config = {
  programs: [{ id: 'p1', name: '프로그램A' }],
  subjects: [{ id: 'sub1', name: '수학' }],
}

const userNames = {
  e1: { name: '김강사' },
  e2: { name: '이강사' },
}

const students = [
  { id: 's1', name: '박학생', phone: '01011112222', parentPhone: '01033334444' },
]

function makeReservation(overrides = {}) {
  return {
    id: 'r1',
    studentId: 's1',
    programId: 'p1',
    status: 'confirmed',
    attendanceStatus: 'pending',
    slot: {
      date: '2026-07-20',
      startTime: '10:00',
      endTime: '11:00',
      educatorId: 'e1',
      subjectId: 'sub1',
    },
    ...overrides,
  }
}

describe('buildReservationSheets', () => {
  it('기본값: 전체 시트 + 상담사별 시트로 분리된다', () => {
    const reservations = [
      makeReservation({ id: 'r1' }),
      makeReservation({ id: 'r2', slot: { ...makeReservation().slot, educatorId: 'e2' } }),
    ]
    const sheets = buildReservationSheets({ reservations, students, userNames, config })
    expect(sheets.map((s) => s.name)).toEqual(['전체', '김강사', '이강사'])
    expect(sheets[0].rows).toHaveLength(2)
    expect(sheets[1].rows).toHaveLength(1)
    expect(sheets[2].rows).toHaveLength(1)
  })

  it('slot 없는 예약은 제외된다', () => {
    const reservations = [makeReservation({ id: 'r1' }), { id: 'r2', studentId: 's1', slot: null }]
    const sheets = buildReservationSheets({ reservations, students, userNames, config })
    expect(sheets[0].rows).toHaveLength(1)
  })

  it('splitByEducator=false면 전체 시트 1장만 반환된다', () => {
    const reservations = [
      makeReservation({ id: 'r1' }),
      makeReservation({ id: 'r2', slot: { ...makeReservation().slot, educatorId: 'e2' } }),
    ]
    const sheets = buildReservationSheets({ reservations, students, userNames, config, splitByEducator: false })
    expect(sheets).toHaveLength(1)
    expect(sheets[0].name).toBe('전체')
    expect(sheets[0].rows).toHaveLength(2)
  })

  it('행 컬럼 순서: 날짜/시간/프로그램/교과/상담사/학생/학생연락처/학부모연락처/상태', () => {
    const sheets = buildReservationSheets({
      reservations: [makeReservation()],
      students,
      userNames,
      config,
      splitByEducator: false,
    })
    const row = sheets[0].rows[0]
    expect(row[0]).toBe('2026-07-20')
    expect(row[1]).toBe('10:00~11:00')
    expect(row[2]).toBe('프로그램A')
    expect(row[3]).toBe('수학')
    expect(row[4]).toBe('김강사')
    expect(row[5]).toBe('박학생')
  })
})
