import { Text } from '@react-pdf/renderer'
import PageWrapper from '../components/PageWrapper'
import Section from '../components/Section'
import Table from '../components/Table'
import KpiGrid from '../components/KpiGrid'
import { colors } from '../config/styles'

const scoreColor = (pct) => {
  if (pct >= 80) return colors.accentGreen
  if (pct >= 60) return colors.accentAmber
  return colors.accentRed
}

export default function QuizReport({
  summaries,
  attempts,
  students,
  quizSets,
  period,
  generatedAt,
  author,
}) {
  const studentById = Object.fromEntries(students.map((s) => [s.id, s]))
  const setById = Object.fromEntries(quizSets.map((s) => [s.id, s]))

  const totalEligible = summaries.reduce((sum, s) => sum + s.eligibleCount, 0)
  const totalSubmitted = summaries.reduce((sum, s) => sum + s.submittedCount, 0)
  const overallRate = totalEligible > 0 ? Math.round((totalSubmitted / totalEligible) * 100) : 0
  const overallAvg = attempts.length > 0
    ? Math.round(
        (attempts.reduce(
          (sum, a) => sum + (a.total > 0 ? a.score / a.total : 0),
          0,
        ) /
          attempts.length) *
          100,
      )
    : 0

  const kpiItems = [
    { label: '전체 회차', value: summaries.length, unit: '회' },
    { label: '전체 응시', value: totalSubmitted, unit: '건' },
    { label: '전체 응시율', value: `${overallRate}%` },
    { label: '전체 평균 정답률', value: `${overallAvg}%` },
  ]

  const summaryColumns = [
    { key: 'grade', header: '학년', width: '10%', align: 'center' },
    { key: 'round', header: '회차', width: '10%', align: 'center' },
    { key: 'title', header: '제목', width: '34%' },
    { key: 'eligible', header: '대상', width: '10%', align: 'right' },
    { key: 'submitted', header: '응시', width: '10%', align: 'right' },
    { key: 'missing', header: '미응시', width: '10%', align: 'right' },
    { key: 'avgPct', header: '평균 정답률', width: '16%', align: 'right' },
  ]

  const summaryRows = summaries.map(({ set, eligibleCount, submittedCount, missingCount, avgPct }) => ({
    key: set.id,
    grade: set.grade,
    round: `${set.round}회`,
    title: set.title,
    eligible: `${eligibleCount}명`,
    submitted: `${submittedCount}명`,
    missing: `${missingCount}명`,
    avgPct: `${avgPct}%`,
  }))

  const sortedAttempts = [...attempts].sort((a, b) =>
    (b.submittedAt || '').localeCompare(a.submittedAt || ''),
  )

  const attemptColumns = [
    { key: 'idx', header: '순번', width: '6%', align: 'center' },
    { key: 'student', header: '학생', width: '14%' },
    { key: 'grade', header: '학년', width: '8%', align: 'center' },
    { key: 'set', header: '회차', width: '34%' },
    { key: 'score', header: '점수', width: '12%', align: 'right' },
    { key: 'pct', header: '정답률', width: '12%', align: 'right' },
    { key: 'submitted', header: '제출일', width: '14%', align: 'center' },
  ]

  const attemptRows = sortedAttempts.map((a, idx) => {
    const stu = studentById[a.studentId]
    const set = setById[a.quizSetId]
    const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
    return {
      key: a.id,
      idx: idx + 1,
      student: stu?.name ?? a.studentId,
      grade: stu?.grade ?? '-',
      set: set ? `${set.grade} ${set.round}회 · ${set.title}` : a.quizSetId,
      score: `${a.score} / ${a.total}`,
      pct: (
        <Text style={{ color: scoreColor(pct), fontWeight: 600, textAlign: 'right' }}>
          {pct}%
        </Text>
      ),
      submitted: a.submittedAt ? a.submittedAt.slice(0, 10) : '-',
    }
  })

  return (
    <PageWrapper
      reportTitle="확인평가 보고서"
      period={period}
      generatedAt={generatedAt}
      author={author}
    >
      <Section title="전체 현황 요약">
        <KpiGrid items={kpiItems} columns={4} />
      </Section>

      <Section title="회차별 응시 요약">
        <Table
          columns={summaryColumns}
          rows={summaryRows}
          emptyText="등록된 회차가 없습니다."
        />
      </Section>

      <Section title={`응시 이력 (${attemptRows.length}건)`}>
        <Table
          columns={attemptColumns}
          rows={attemptRows}
          emptyText="응시 이력이 없습니다."
        />
      </Section>
    </PageWrapper>
  )
}
