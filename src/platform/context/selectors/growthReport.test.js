import { describe, it, expect } from 'vitest'
import {
  buildMonthlyUsage, summarySubjectKey, buildSubjectCoachingSummary, buildExamTrend,
  buildCareerSummaryText, buildDiagnosisSummaryText, defaultSummaryTitle, NO_TEST_TEXT,
  buildGrowthReportData, buildWeeklyUsage, consultMinutes,
  buildConsultingBySubject, buildCoachingAutoText, DEFAULT_CONSULT_MINUTES,
} from './growthReport.js'

const S = 's1'
const PERIOD = { studentId: S, startDate: '2026-08-01', endDate: '2026-08-31' }

const att = (date, inH, outH) => ({
  studentId: S,
  date,
  status: 'present',
  checkInAt: `${date}T0${inH}:00:00+09:00`,
  checkOutAt: `${date}T0${outH}:00:00+09:00`,
  events: [],
})

describe('buildWeeklyUsage', () => {
  it('기간을 7일 주차로 쪼개고 이용시간을 합산한다', () => {
    const rows = [att('2026-08-01', 1, 3), att('2026-08-08', 2, 3)]
    const weeks = buildWeeklyUsage(rows, '2026-08-01', '2026-08-31')
    expect(weeks).toHaveLength(5)
    expect(weeks[0].label).toBe('8/1~8/7')
    expect(weeks[0].minutes).toBe(120)
    expect(weeks[1].minutes).toBe(60)
    // 마지막 주는 말일에서 잘린다
    expect(weeks[4].label).toBe('8/29~8/31')
  })
})

describe('consultMinutes', () => {
  it('시작·종료 시간이 있으면 간격, 없으면 기본 60분', () => {
    expect(consultMinutes({ startTime: '14:00', endTime: '15:30' })).toBe(90)
    expect(consultMinutes({ startTime: '', endTime: '' })).toBe(DEFAULT_CONSULT_MINUTES)
    expect(consultMinutes({ startTime: '15:00', endTime: '14:00' })).toBe(DEFAULT_CONSULT_MINUTES)
  })
})

describe('buildConsultingBySubject', () => {
  it('담당 강사의 교과별로 횟수·시간을 집계하고 미상은 기타로 묶는다', () => {
    const educators = [{ id: 'e1', subject: '수학' }, { id: 'e2', subject: '' }]
    const records = [
      { educatorId: 'e1', startTime: '14:00', endTime: '15:00' },
      { educatorId: 'e1', startTime: '', endTime: '' },
      { educatorId: 'e2', startTime: '10:00', endTime: '10:30' },
      { educatorId: 'ghost', startTime: '', endTime: '' },
    ]
    const { rows, totalSessions, totalMinutes } = buildConsultingBySubject(records, educators)
    expect(totalSessions).toBe(4)
    expect(totalMinutes).toBe(60 + 60 + 30 + 60)
    const math = rows.find((r) => r.name === '수학')
    expect(math).toMatchObject({ sessions: 2, minutes: 120 })
    expect(rows.find((r) => r.name === '기타')).toMatchObject({ sessions: 2, minutes: 90 })
  })
})

describe('buildCoachingAutoText', () => {
  it('날짜순으로 comment 우선, 없으면 구조화 필드로 조립한다', () => {
    const text = buildCoachingAutoText([
      { date: '2026-08-10', comment: '', topic: '플래너 점검', advice: '주간 계획 세우기' },
      { date: '2026-08-03', comment: '집중 시간 관리 코칭' },
    ])
    expect(text.split('\n')).toEqual([
      '8/3 · 집중 시간 관리 코칭',
      '8/10 · 플래너 점검 / 주간 계획 세우기',
    ])
  })
})

describe('buildGrowthReportData', () => {
  const src = {
    attendanceRecords: [att('2026-08-04', 1, 4), att('2026-07-30', 1, 4)],
    learningRecords: [
      { studentId: S, date: '2026-08-05', subject: '수학', studyMethod: '문제풀기', duration: 60, actualDuration: 60, focus: 80 },
      { studentId: S, date: '2026-07-05', subject: '영어', studyMethod: '암기', duration: 30, actualDuration: 30, focus: 50 },
      { studentId: 'other', date: '2026-08-05', subject: '국어', duration: 45, actualDuration: 45 },
    ],
    counselingRecords: [
      { studentId: S, date: '2026-08-06', type: 'subject_learning', educatorId: 'e1', startTime: '14:00', endTime: '15:00' },
      { studentId: S, date: '2026-08-07', type: 'self_directed', comment: '코칭 메모' },
      { studentId: S, date: '2026-07-01', type: 'subject_learning', educatorId: 'e1' },
    ],
    educators: [{ id: 'e1', subject: '수학' }],
    tasks: [
      { studentId: S, title: '워크북', subject: '수학', dueDate: '2026-08-10', status: 'done' },
      { studentId: S, title: '지난 과제', subject: '영어', dueDate: '2026-07-10', status: 'pending' },
    ],
    quizAttempts: [
      { id: 'q1', studentId: S, quizSetId: 'set1', score: 8, total: 10, submittedAt: '2026-08-05T10:00:00+09:00' },
      { id: 'q2', studentId: S, quizSetId: 'set1', score: 5, total: 10, submittedAt: '2026-07-05T10:00:00+09:00' },
    ],
    quizSets: [{ id: 'set1', subject: '국어', round: 3, title: '확인평가 3회' }],
    mindRecords: [
      { studentId: S, date: '2026-08-08', mood: 3, motivation: 3, confidence: 3 },
    ],
    studentFeedbacks: [
      { id: 'f1', studentId: S, date: '2026-08-09', authorName: '황광희', content: '집중력이 좋아졌어요' },
      { id: 'f0', studentId: S, date: '2026-07-09', authorName: '황광희', content: '기간 밖' },
    ],
  }

  it('기간·학생으로 거른 뒤 각 섹션을 조립한다', () => {
    const r = buildGrowthReportData(src, PERIOD)
    expect(r.usage.totalMinutes).toBe(180) // 8/4 1시→4시, 7/30은 기간 밖
    expect(r.study.totalMinutes).toBe(60)
    expect(r.study.subjectDist).toEqual([{ name: '수학', minutes: 60 }])
    expect(r.study.methodDist).toEqual([{ name: '문제풀기', minutes: 60 }])
    expect(r.consulting.totalSessions).toBe(1)
    expect(r.consulting.rows[0]).toMatchObject({ name: '수학', minutes: 60 })
    expect(r.coaching.autoText).toBe('8/7 · 코칭 메모')
    expect(r.feedbacks).toHaveLength(1)
    expect(r.quiz.rows).toHaveLength(1)
    expect(r.quiz.avgPct).toBe(80)
    expect(r.tasks).toMatchObject({ total: 1, done: 1, rate: 1 })
    expect(r.mind.stability).toBe(80) // 합산 9 → (9+15)/30*100
  })
})

describe('buildMonthlyUsage', () => {
  it('달별로 합산하고 해를 넘기면 연도를 라벨에 붙인다', () => {
    const rows = [att('2026-07-03', 1, 3), att('2026-08-04', 1, 2), att('2026-08-05', 1, 2)]
    const r = buildMonthlyUsage(rows, '2026-07-01', '2026-09-30')
    expect(r.map((x) => x.label)).toEqual(['7월', '8월', '9월'])
    expect(r.map((x) => x.minutes)).toEqual([120, 120, 0])
    const c = buildMonthlyUsage([], '2026-11-01', '2027-02-28')
    expect(c.map((x) => x.label)).toEqual(['26.11월', '26.12월', '27.1월', '27.2월'])
  })
})

describe('요약 리포트 빌더', () => {
  it('강사 담당 교과 문자열을 4교과로 매핑하고 비교과는 제외한다', () => {
    expect(summarySubjectKey('수학')).toBe('수학')
    expect(summarySubjectKey('영어')).toBe('영어')
    expect(summarySubjectKey('비교과 계열심화 자연')).toBeNull()
    expect(summarySubjectKey('')).toBeNull()
  })

  it('교과 코칭을 교과별 횟수·자동 텍스트로 묶는다', () => {
    const educators = [{ id: 't2', subject: '수학' }, { id: 'cs', subject: '비교과 계열심화 자연' }]
    const recs = [
      { type: 'subject_learning', educatorId: 't2', date: '2026-08-02', comment: '분수 복습' },
      { type: 'subject_learning', educatorId: 'cs', date: '2026-08-03', comment: '제외' },
      { type: 'self_directed', educatorId: 't2', date: '2026-08-04', comment: '제외2' },
    ]
    const r = buildSubjectCoachingSummary(recs, educators)
    expect(r.수학).toEqual({ count: 1, autoText: '8/2 · 분수 복습' })
    expect(r.영어.count).toBe(0)
  })

  it('내신 추이: 종료일 학년도의 4시험 평균, 없으면 null, 실천과제는 최근 시험', () => {
    const fbs = [
      { studentId: S, examYear: 2026, semester: 1, examType: 'mid', subjects: [{ score: 80 }, { score: 91 }, { score: '' }], actionPlan: '1학기' },
      { studentId: S, examYear: 2026, semester: 2, examType: 'mid', subjects: [{ score: 70 }], actionPlan: '2학기 중간' },
      { studentId: 'other', examYear: 2026, semester: 1, examType: 'final', subjects: [{ score: 10 }] },
    ]
    const r = buildExamTrend(fbs, S, '2026-11-30')
    expect(r.examYear).toBe(2026)
    expect(r.bars.map((b) => b.score)).toEqual([85.5, null, 70, null])
    expect(r.actionPlan).toBe('2학기 중간')
    // 1~2월은 직전 학년도
    expect(buildExamTrend(fbs, S, '2027-02-28').examYear).toBe(2026)
  })

  it('진로·학습 진단 요약: 종료일 이전 최신 결과, 없으면 검사 기록 없음', () => {
    const career = [{ studentId: S, date: '2026-10-01', typeName: '공학 중심형', finalScores: { ENGINEERING: 9, NATURAL: 5, SOCIAL: 0 }, fields: [{ field: '로봇' }] }]
    const t = buildCareerSummaryText(career, S, '2026-11-30')
    expect(t).toContain('공학 중심형')
    expect(t).toContain('공학 > 자연')
    expect(t).toContain('로봇')
    expect(buildCareerSummaryText(career, S, '2026-09-30')).toBe(NO_TEST_TEXT)
    const diag = [{ studentId: S, date: '2026-10-05', typeName: '균형 성장형', stageGrades: { basic: 'A', organize: 'B' } }]
    expect(buildDiagnosisSummaryText(diag, S, '2026-11-30')).toContain('기초 A · 정리 B')
    expect(buildDiagnosisSummaryText([], S, '2026-11-30')).toBe(NO_TEST_TEXT)
  })

  it('제목 기본값: N기가 있으면 연도 조합, 없으면 그룹명', () => {
    expect(defaultSummaryTitle(['안동NAVI 4기'], '2026')).toBe('NAVI : 2026 4기')
    expect(defaultSummaryTitle(['안동NAVI'], '2026')).toBe('NAVI : 안동NAVI')
    expect(defaultSummaryTitle([], '2026')).toBe('NAVI')
  })
})
