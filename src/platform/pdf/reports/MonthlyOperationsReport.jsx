// 월간 종합 보고서 — 강사별 컨설팅·수업 시수 + 학생 이용 현황.
// 데이터 조립은 selectors/monthlyOperationsReport.js — 여기는 순수 props만 (DataContext 금지).
// props: { period, generatedAt, author, counseling, lessons, attendance }
//   counseling/lessons: { rows, totals } (buildMonthlyCounselingStats / buildMonthlyLessonStats)
//   attendance: { presentCount, usageText } (buildAttendanceUsage)
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import PageWrapper from '../components/PageWrapper'
import Section from '../components/Section'
import Table from '../components/Table'
import KpiGrid from '../components/KpiGrid'
import { colors, fontSize } from '../config/styles'

const styles = StyleSheet.create({
  notes: {
    marginTop: 4,
  },
  noteText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginBottom: 2,
  },
})

const COUNSELING_COLUMNS = [
  { key: 'name', header: '담당자', width: '26%' },
  { key: 'category', header: '구분', width: '24%' },
  { key: 'sessions', header: '상담횟수', width: '14%', align: 'right' },
  { key: 'minutesText', header: '상담시간', width: '20%', align: 'right' },
  { key: 'hours', header: '시수', width: '16%', align: 'right' },
]

const LESSON_COLUMNS = [
  { key: 'name', header: '담당자', width: '34%' },
  { key: 'sessions', header: '수업횟수', width: '16%', align: 'right' },
  { key: 'minutesText', header: '수업시간', width: '26%', align: 'right' },
  { key: 'hours', header: '시수', width: '24%', align: 'right' },
]

const NOTES = [
  '집계 기준: 교과·기타 컨설팅 60분(20분×3)=1시수 · 진로진학 컨설팅 40분=1시수 · 교과 수업 60분=1시수',
  '세션 50~70분은 60분으로 계산 · 시간 미입력 세션은 최소 단위(교과 컨설팅 20분·진로진학 40분·수업 60분)로 계산',
  '그룹 상담은 1회로 집계 · 이용시간은 입실~퇴실(재등원 시 체류 구간 합) 기준 · 출석 인원은 지각 포함 연인원',
]

function statRow(row) {
  return {
    ...row,
    sessions: `${row.sessions}회`,
    hours: `${row.hours}시수`,
  }
}

export default function MonthlyOperationsReport({
  period,
  generatedAt,
  author,
  counseling,
  lessons,
  attendance,
}) {
  // 데이터가 없으면 합계 행도 생략 — Table의 빈 상태 문구를 그대로 노출
  const counselingRows = (counseling?.rows ?? []).length === 0
    ? []
    : [
        ...counseling.rows.map(statRow),
        statRow({ ...counseling.totals, name: '합계', category: '' }),
      ]
  const lessonRows = (lessons?.rows ?? []).length === 0
    ? []
    : [
        ...lessons.rows.map(statRow),
        statRow({ ...lessons.totals, name: '합계' }),
      ]

  return (
    <PageWrapper
      reportTitle="월간 종합 보고서"
      period={period}
      generatedAt={generatedAt}
      author={author}
    >
      <Section title="학생 이용 현황">
        <KpiGrid
          columns={2}
          items={[
            { label: '누적 출석 인원', value: attendance?.presentCount ?? '-', unit: '명' },
            { label: '총 센터 이용시간', value: attendance?.usageText ?? '-' },
          ]}
        />
      </Section>

      <Section title="컨설팅 (강사별)">
        <Table columns={COUNSELING_COLUMNS} rows={counselingRows} />
      </Section>

      <Section title="수업 (강사별)">
        <Table columns={LESSON_COLUMNS} rows={lessonRows} />
      </Section>

      <View style={styles.notes}>
        {NOTES.map((note) => (
          <Text key={note} style={styles.noteText}>{note}</Text>
        ))}
      </View>
    </PageWrapper>
  )
}
