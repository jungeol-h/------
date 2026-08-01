import { describe, it, expect } from 'vitest'
import {
  formatKoreanDate,
  formatAmPm,
  durationMinutes,
  formatCounselingDateTime,
  formatCompactDateTime,
  currentMonthRange,
  buildMonthlyCounselingEntries,
} from './monthlyCounselingReport.js'

describe('formatKoreanDate', () => {
  it('요일 포함 양식 표기', () => {
    expect(formatKoreanDate('2026-07-04')).toBe('2026. 7. 4.(토)')
    expect(formatKoreanDate('2026-01-01')).toBe('2026. 1. 1.(목)')
  })

  it('빈 값이면 빈 문자열', () => {
    expect(formatKoreanDate('')).toBe('')
    expect(formatKoreanDate(undefined)).toBe('')
  })
})

describe('formatAmPm', () => {
  it('12시간제 변환', () => {
    expect(formatAmPm('14:00')).toBe('pm 2:00')
    expect(formatAmPm('09:05')).toBe('am 9:05')
  })

  it('자정·정오 경계', () => {
    expect(formatAmPm('00:30')).toBe('am 12:30')
    expect(formatAmPm('12:00')).toBe('pm 12:00')
  })

  it('파싱 불가면 빈 문자열', () => {
    expect(formatAmPm('')).toBe('')
    expect(formatAmPm('abc')).toBe('')
  })
})

describe('durationMinutes', () => {
  it('분 차이 계산', () => {
    expect(durationMinutes('14:00', '14:20')).toBe(20)
    expect(durationMinutes('11:50', '12:10')).toBe(20)
  })

  it('역전·동일·파싱 실패는 null', () => {
    expect(durationMinutes('14:20', '14:00')).toBe(null)
    expect(durationMinutes('14:00', '14:00')).toBe(null)
    expect(durationMinutes('', '14:00')).toBe(null)
  })
})

describe('formatCounselingDateTime', () => {
  it('날짜 + 시작~종료 + 소요분', () => {
    expect(formatCounselingDateTime('2026-07-04', '14:00', '14:20')).toBe(
      '2026. 7. 4.(토) pm 2:00 ~ pm 2:20 (20분)',
    )
  })

  it('시간 없으면 날짜만 (외부상담 경로)', () => {
    expect(formatCounselingDateTime('2026-07-04', '', '')).toBe('2026. 7. 4.(토)')
  })

  it('시작만 있으면 종료·분 생략', () => {
    expect(formatCounselingDateTime('2026-07-04', '14:00', '')).toBe('2026. 7. 4.(토) pm 2:00')
  })

  it('역전이면 분 표기만 생략', () => {
    expect(formatCounselingDateTime('2026-07-04', '14:20', '14:00')).toBe(
      '2026. 7. 4.(토) pm 2:20 ~ pm 2:00',
    )
  })
})

describe('formatCompactDateTime', () => {
  it('연도 생략 + 24h 표기 (보고서 메타줄용)', () => {
    expect(formatCompactDateTime('2026-07-04', '14:00', '14:20')).toBe('7. 4.(토) 14:00~14:20 (20분)')
    expect(formatCompactDateTime('2026-07-04', '', '')).toBe('7. 4.(토)')
    expect(formatCompactDateTime('2026-07-04', '14:00', '')).toBe('7. 4.(토) 14:00')
  })
})

describe('currentMonthRange', () => {
  it('이번 달 1일~말일', () => {
    expect(currentMonthRange(new Date('2026-07-17T12:00:00'))).toEqual(['2026-07-01', '2026-07-31'])
  })

  it('윤년 2월', () => {
    expect(currentMonthRange(new Date('2028-02-10T12:00:00'))).toEqual(['2028-02-01', '2028-02-29'])
  })
})

describe('buildMonthlyCounselingEntries', () => {
  const getStudent = (id) =>
    ({
      s1: { name: '김학생', school: '산청중', grade: '2학년' },
      s2: { name: '이학생', school: '우정중', grade: '1학년' },
    })[id]

  const base = { topic: '진로', diagnosis: '진단', advice: '조언', followUp: '후속', note: '' }
  const opts = { educatorId: 'e1', startDate: '2026-07-01', endDate: '2026-07-31' }

  it('누적횟수는 기간 이전 이력을 포함해 학생×강사 기준으로 센다', () => {
    const records = [
      { id: 'r1', studentId: 's1', educatorId: 'e1', date: '2026-05-10', ...base },
      { id: 'r2', studentId: 's1', educatorId: 'e1', date: '2026-06-14', ...base },
      { id: 'r3', studentId: 's1', educatorId: 'e1', date: '2026-07-04', ...base },
      // 타 강사 기록 — 누적에서 제외
      { id: 'r4', studentId: 's1', educatorId: 'e2', date: '2026-06-01', ...base },
    ]
    const { entries, totalCount } = buildMonthlyCounselingEntries(records, getStudent, opts)
    expect(totalCount).toBe(1)
    expect(entries[0].cumulativeText).toBe('3회차')
    expect(entries[0].no).toBe(1)
    expect(entries[0].studentName).toBe('김학생')
    expect(entries[0].schoolGrade).toBe('산청중 2학년')
  })

  it('기간 경계(1일·말일) 포함, 기간 밖 제외', () => {
    const records = [
      { id: 'r1', studentId: 's1', educatorId: 'e1', date: '2026-06-30', ...base },
      { id: 'r2', studentId: 's1', educatorId: 'e1', date: '2026-07-01', ...base },
      { id: 'r3', studentId: 's2', educatorId: 'e1', date: '2026-07-31', ...base },
      { id: 'r4', studentId: 's2', educatorId: 'e1', date: '2026-08-01', ...base },
    ]
    const { entries } = buildMonthlyCounselingEntries(records, getStudent, opts)
    expect(entries.map((e) => e.cumulativeText)).toEqual(['2회차', '1회차'])
    expect(entries.map((e) => e.no)).toEqual([1, 2])
  })

  it('같은 날 여러 건은 startTime 순으로 안정 정렬', () => {
    const records = [
      { id: 'r2', studentId: 's1', educatorId: 'e1', date: '2026-07-04', startTime: '15:00', endTime: '15:20', ...base },
      { id: 'r1', studentId: 's1', educatorId: 'e1', date: '2026-07-04', startTime: '14:00', endTime: '14:20', ...base },
    ]
    const { entries } = buildMonthlyCounselingEntries(records, getStudent, opts)
    expect(entries[0].dateTimeText).toBe('7. 4.(토) 14:00~14:20 (20분)')
    expect(entries[0].cumulativeText).toBe('1회차')
    expect(entries[1].cumulativeText).toBe('2회차')
  })

  it('구조화 안 된 구 기록은 fallbackContent 전문 경로', () => {
    const records = [
      {
        id: 'r1', studentId: 's1', educatorId: 'e1', date: '2026-07-04',
        topic: '', diagnosis: '', advice: '', followUp: '', note: '',
        fallbackContent: '단일 텍스트 상담 내용',
      },
    ]
    const { entries } = buildMonthlyCounselingEntries(records, getStudent, opts)
    expect(entries[0].fallbackContent).toBe('단일 텍스트 상담 내용')
    expect(entries[0].topic).toBe('')
  })

  it('그룹 상담 fan-out(학생 외 내용 동일)은 한 세션으로 병합한다', () => {
    const session = { date: '2026-07-04', startTime: '14:00', endTime: '14:40', ...base }
    const records = [
      // s1은 6월 이력 1건 → 이번 세션이 2회차
      { id: 'r0', studentId: 's1', educatorId: 'e1', date: '2026-06-10', ...base },
      { id: 'r1', studentId: 's1', educatorId: 'e1', ...session },
      { id: 'r2', studentId: 's2', educatorId: 'e1', ...session },
    ]
    const { entries, totalCount } = buildMonthlyCounselingEntries(records, getStudent, opts)
    expect(totalCount).toBe(1)
    expect(entries[0].studentName).toBe('김학생, 이학생')
    expect(entries[0].schoolGrade).toBe('2명')
    expect(entries[0].cumulativeText).toBe('김학생 2회차 · 이학생 1회차')
  })

  it('그룹 상담 회차가 전원 동일하면 "각 N회차"로 압축', () => {
    const session = { date: '2026-07-04', startTime: '14:00', endTime: '14:40', ...base }
    const records = [
      { id: 'r1', studentId: 's1', educatorId: 'e1', ...session },
      { id: 'r2', studentId: 's2', educatorId: 'e1', ...session },
    ]
    const { entries } = buildMonthlyCounselingEntries(records, getStudent, opts)
    expect(entries[0].cumulativeText).toBe('각 1회차')
  })

  it('같은 날 시간 없이 따로 쓴 개별 상담(주제 상이)은 병합하지 않는다', () => {
    const records = [
      { id: 'r1', studentId: 's1', educatorId: 'e1', date: '2026-07-04', ...base, topic: '국어 학습' },
      { id: 'r2', studentId: 's2', educatorId: 'e1', date: '2026-07-04', ...base, topic: '진로 탐색' },
    ]
    const { entries } = buildMonthlyCounselingEntries(records, getStudent, opts)
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.schoolGrade)).toEqual(['산청중 2학년', '우정중 1학년'])
  })

  it('types 필터 — 해당 유형(구 체계 별칭 포함)만 출력하고 누적 회차도 유형 안에서 센다', () => {
    const records = [
      { id: 'r1', studentId: 's1', educatorId: 'e1', date: '2026-06-01', type: 'subject_learning', ...base },
      { id: 'r2', studentId: 's1', educatorId: 'e1', date: '2026-06-20', type: 'career', ...base },
      { id: 'r3', studentId: 's1', educatorId: 'e1', date: '2026-07-04', type: 'career_path', ...base },
    ]
    const { entries, totalCount } = buildMonthlyCounselingEntries(records, getStudent, {
      ...opts,
      types: ['career_path', 'career'],
    })
    expect(totalCount).toBe(1)
    // 교과학습(r1)은 회차에서 제외 — 구 '진로'(r2) 포함 진로진학 2회차
    expect(entries[0].cumulativeText).toBe('2회차')
  })

  it('미등록 학생·빈 records 방어', () => {
    const records = [
      { id: 'r1', studentId: 'ghost', educatorId: 'e1', date: '2026-07-04', ...base },
    ]
    const { entries } = buildMonthlyCounselingEntries(records, getStudent, opts)
    expect(entries[0].studentName).toBe('-')
    expect(entries[0].schoolGrade).toBe('')
    expect(buildMonthlyCounselingEntries([], getStudent, opts)).toEqual({ entries: [], totalCount: 0 })
  })
})
