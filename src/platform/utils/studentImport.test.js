import { describe, it, expect } from 'vitest'
import {
  parseStudentSheet, normalizePhone, normalizeGrade, cleanText,
} from './studentImport.js'

// 구글폼 응답 시트 형태 (신청서 실데이터의 축약형)
const HEADER = [
  '사전 설문\n등록확정', '학생', '학교', '학년', '학생연락처',
  '학부모', '학부모연락처', '신청동기', '자기소개',
]
const sheet = (...rows) => [HEADER, ...rows]

describe('normalizePhone / normalizeGrade / cleanText', () => {
  it('공백·하이픈·전각숫자를 정규화한다', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678')
    expect(normalizePhone('010 1234  5678')).toBe('01012345678')
    expect(normalizePhone('０１０12345678')).toBe('01012345678')
  })
  it('학년 표기를 중N으로 통일한다', () => {
    expect(normalizeGrade('1학년')).toBe('중1')
    expect(normalizeGrade('중3')).toBe('중3')
    expect(normalizeGrade('')).toBe('')
    expect(normalizeGrade('4학년')).toBe('')
  })
  it('보이지 않는 문자와 연속 공백을 정리한다', () => {
    expect(cleanText('김두성​  중')).toBe('김두성 중')
    expect(cleanText('  이름\n성명 ')).toBe('이름 성명')
  })
})

describe('parseStudentSheet', () => {
  it('헤더를 찾아 행을 매핑하고, 취소 상태를 cancelled로 판정한다', () => {
    const res = parseStudentSheet(sheet(
      ['등록완료', '강민채', '길주중', '1학년', '010-1111-2222', '정선희', '010-3333-4444'],
      ['신청취소', '김지연', '안동여중', '2학년', '01055556666', '김윤경', '010-7777-8888'],
      ['미등록', '구민경', '길주중', '2학년', '010-9999-0000', '박정숙', '010-1212-3434'],
    ))
    expect(res.ok).toBe(true)
    expect(res.rows).toHaveLength(3)
    const [a, b, c] = res.rows
    expect(a).toMatchObject({ name: '강민채', grade: '중1', phone: '01011112222', status: 'active', loginId: '강민채' })
    expect(b).toMatchObject({ status: 'cancelled', gender: 'F' })
    expect(c.status).toBe('active') // 미등록도 가입 대상
    expect(a.gender).toBeNull()
    expect(res.summary).toMatchObject({ total: 3, included: 3, cancelled: 1 })
  })

  it('제목 행이 헤더 위에 있어도 헤더를 찾는다', () => {
    const res = parseStudentSheet([
      ['NAVI 4기 신청자 명단'],
      [],
      ...sheet(['등록완료', '강민채', '길주중', '1학년', '01011112222', '정선희', '01033334444']),
    ])
    expect(res.ok).toBe(true)
    expect(res.headerRowIndex).toBe(2)
    expect(res.rows).toHaveLength(1)
  })

  it('이름 칼럼이 없으면 실패한다', () => {
    const res = parseStudentSheet([['가나다', '라마바'], ['1', '2']])
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/헤더/)
  })

  it('같은 이름+학교 재제출은 마지막 행만 채택한다', () => {
    const res = parseStudentSheet(sheet(
      ['등록완료', '이나라', '안동여중', '3학년', '4', '나순옥', '010-9645-5527'],
      ['등록완료', '이나라', '안동여중', '3학년', '010-8611-6004', '나순옥', '010-9645-5527'],
    ))
    const [first, last] = res.rows
    expect(first.include).toBe(false)
    expect(first.note).toMatch(/재제출/)
    expect(last.include).toBe(true)
    expect(last.phone).toBe('01086116004')
    expect(res.summary.included).toBe(1)
  })

  it('동명이인(학교 다름)은 login_id를 이름(학교)로 구분한다', () => {
    const res = parseStudentSheet(sheet(
      ['미등록', '김재현', '경안중', '3학년', '010-8640-3400', '임지은', '010-8592-7433'],
      ['미등록', '김재현', '안동중', '3학년', '01039811050', '오경애', '01099051010'],
    ))
    expect(res.rows.map((r) => r.loginId)).toEqual(['김재현(경안중)', '김재현(안동중)'])
    expect(res.summary.included).toBe(2)
  })

  it('이미 등록된 login_id는 제외한다', () => {
    const res = parseStudentSheet(sheet(
      ['등록완료', '강민채', '길주중', '1학년', '01011112222', '정선희', '01033334444'],
      ['등록완료', '신입생', '길주중', '1학년', '01011113333', '아무개', '01033335555'],
    ), { existingLoginIds: ['강민채'] })
    expect(res.rows[0].include).toBe(false)
    expect(res.rows[0].note).toMatch(/이미 등록/)
    expect(res.rows[1].include).toBe(true)
  })

  it('전화번호 형식 오류는 포함하되 경고를 남긴다', () => {
    const res = parseStudentSheet(sheet(
      ['등록완료', '박학생', '길주중', '1학년', '1234', '보호자', '01033334444'],
    ))
    const r = res.rows[0]
    expect(r.include).toBe(true)
    expect(r.phoneValid).toBe(false)
    expect(r.note).toMatch(/전화번호/)
  })
})

describe('parseStudentSheet — 기존 학생 동일인 검사 (existingStudents)', () => {
  // 2026-07 중복 사고 유형: 이름 오타(김다민→김다인)여도 전화번호가 같으면 동일인
  const existingStudents = [
    { name: '김다인', school: '단성중', password: '01084355192', parentPassword: '01026315192', status: 'active' },
    { name: '강은성', school: '안동여중', password: '01020401766', parentPassword: '01020471766', status: 'withdrawn' },
  ]

  it('이름이 달라도 전화번호가 같으면 제외한다', () => {
    const res = parseStudentSheet(sheet(
      ['등록완료', '김다민', '단성중학교', '3학년', '010-8435-5192', '보호자', '01026315192'],
    ), { existingStudents })
    const r = res.rows[0]
    expect(r.include).toBe(false)
    expect(r.note).toMatch(/전화번호 일치/)
    expect(r.note).toMatch(/김다인/)
  })

  it('퇴원 계정과 이름+학교가 같으면 제외하고 복구를 안내한다', () => {
    const res = parseStudentSheet(sheet(
      ['등록완료', '강은성', '안동여중', '2학년', '010-4020-1766', '보호자', '01020471766'],
    ), { existingStudents })
    const r = res.rows[0]
    expect(r.include).toBe(false)
    expect(r.note).toMatch(/퇴원/)
    expect(r.note).toMatch(/복구/)
  })

  it('이름+학부모 번호가 같으면 학교 표기가 달라도 제외한다', () => {
    const res = parseStudentSheet(sheet(
      ['등록완료', '강은성', '안동여자중학교', '2학년', '010-4020-1766', '보호자', '010-2047-1766'],
    ), { existingStudents })
    expect(res.rows[0].include).toBe(false)
  })

  it('겹치지 않는 신입생은 통과한다', () => {
    const res = parseStudentSheet(sheet(
      ['등록완료', '신입생', '단성중', '1학년', '01011113333', '아무개', '01033335555'],
    ), { existingStudents })
    expect(res.rows[0].include).toBe(true)
    expect(res.rows[0].note).toBe('')
  })

  it('파일 안에서 다른 이름이 같은 번호를 쓰면 경고만 남기고 포함한다', () => {
    const res = parseStudentSheet(sheet(
      ['등록완료', '학생일', '길주중', '1학년', '01011112222', '보호자', '01033334444'],
      ['등록완료', '학생이', '길주중', '2학년', '010-1111-2222', '보호자', '01033335555'],
    ))
    expect(res.rows.every((r) => r.include)).toBe(true)
    expect(res.rows[0].note).toMatch(/오타 확인/)
    expect(res.rows[1].note).toMatch(/오타 확인/)
  })
})
