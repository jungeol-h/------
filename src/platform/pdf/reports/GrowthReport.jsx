import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { baseStyles, colors, fontSize, spacing } from '../config/styles'
import { ORG_NAME } from '../config/meta'
import Section from '../components/Section'
import Table from '../components/Table'
import KpiGrid from '../components/KpiGrid'
import ChartImage from '../components/ChartImage'
import ReportFooter from '../components/ReportFooter'

// 종합성장리포트 (월간) — 2026-08 클라이언트 개편판.
// 헤더: 나매크 작게 + 그룹명 + 큰 제목("종합성장리포트 8월") + 학생 이름·학교·학년.
// 본문: 이용·학습 KPI → 과목/학습법 분포 파이 → 주차별 이용시간·교과 컨설팅
// 그래프 → 자기주도학습코칭 → 피드백 → 확인평가 → 과제 내역. A4 세로.
// DataContext 의존 금지 — 순수 props만. 데이터 조립: selectors/growthReport.js,
// 차트 PNG: 호출부(GrowthReportModal)가 화면 Recharts를 captureChart로 캡처.
// props: {
//   title, groupName, periodText,
//   student: { name, school, grade },
//   generatedAt, author,
//   charts: { subjectPng, methodPng, weeklyPng, consultingPng }, // dataURL | null
//   usage: { totalMinutes, weekly }, study: { totalMinutes, selfIndex, subjectDist, methodDist },
//   mind: { stability, count }, consulting: { rows, totalSessions, totalMinutes },
//   coachingText, feedbacks, quiz: { rows, avgPct },
//   tasks: { total, done, rate, rows },
// }

const styles = StyleSheet.create({
  page: {
    ...baseStyles.page,
    paddingTop: 108, // 큰 제목 헤더 높이만큼 상향 (기본 84)
  },
  header: {
    position: 'absolute',
    top: spacing.pageMargin,
    left: spacing.pageMargin,
    right: spacing.pageMargin,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
    borderBottomStyle: 'solid',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  orgLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  orgName: {
    fontSize: fontSize.sm,
    fontWeight: 700,
    color: colors.muted,
  },
  groupBadge: {
    marginLeft: 6,
    fontSize: fontSize.xs,
    fontWeight: 600,
    color: colors.accentBlue,
    borderWidth: 0.5,
    borderColor: colors.accentBlue,
    borderStyle: 'solid',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  bigTitle: {
    fontSize: fontSize.title,
    fontWeight: 700,
    color: colors.text,
  },
  metaCol: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  studentLine: {
    fontSize: fontSize.lg,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 2,
  },
  metaLine: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginBottom: 1,
  },
  periodLine: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartHalf: {
    width: '49%',
  },
  chartCaption: {
    fontSize: fontSize.sm,
    fontWeight: 600,
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  textBlock: {
    borderWidth: 0.5,
    borderColor: colors.borderLight,
    borderStyle: 'solid',
    borderRadius: 4,
    backgroundColor: colors.bgLight,
    padding: 8,
  },
  textLine: {
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: 2,
  },
  emptyLine: {
    fontSize: fontSize.sm,
    color: colors.muted,
  },
})

function formatMinutes(min) {
  const m = Math.round(Number(min) || 0)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h > 0) return r > 0 ? `${h}시간 ${r}분` : `${h}시간`
  return `${r}분`
}

// 분포 [{ name, minutes }] → 파이 병기용 표 행 (비중 % 포함)
function distRows(dist) {
  const total = dist.reduce((s, d) => s + d.minutes, 0)
  return dist.map((d) => ({
    key: d.name,
    name: d.name,
    minutes: formatMinutes(d.minutes),
    share: total > 0 ? `${Math.round((d.minutes / total) * 100)}%` : '-',
  }))
}

const DIST_COLUMNS = [
  { key: 'name', header: '구분', width: '44%' },
  { key: 'minutes', header: '시간', width: '32%', align: 'center' },
  { key: 'share', header: '비중', width: '24%', align: 'center' },
]

export default function GrowthReport({
  title,
  groupName = '',
  periodText,
  student = {},
  generatedAt,
  author,
  charts = {},
  usage = { totalMinutes: 0, weekly: [] },
  study = { totalMinutes: 0, selfIndex: null, subjectDist: [], methodDist: [] },
  mind = { stability: null, count: 0 },
  consulting = { rows: [], totalSessions: 0, totalMinutes: 0 },
  coachingText = '',
  feedbacks = [],
  quiz = { rows: [], avgPct: null },
  tasks = { total: 0, done: 0, rate: null, rows: [] },
}) {
  const kpis = [
    { label: '센터 총 이용시간', value: formatMinutes(usage.totalMinutes) },
    { label: '총 학습시간', value: formatMinutes(study.totalMinutes) },
    { label: '자기주도 학습 지수', value: study.selfIndex == null ? '-' : study.selfIndex, unit: study.selfIndex == null ? '' : '점' },
    { label: '마인드 점수', value: mind.stability == null ? '-' : mind.stability, unit: mind.stability == null ? '' : '점' },
  ]

  const consultingColumns = [
    { key: 'name', header: '교과', width: '40%' },
    { key: 'sessions', header: '참여 횟수', width: '30%', align: 'center' },
    { key: 'minutes', header: '시간', width: '30%', align: 'center' },
  ]
  const consultingRows = consulting.rows.map((r) => ({
    key: r.name,
    name: r.name,
    sessions: `${r.sessions}회`,
    minutes: formatMinutes(r.minutes),
  }))

  const quizColumns = [
    { key: 'label', header: '회차', width: '20%' },
    { key: 'title', header: '평가명', width: '30%' },
    { key: 'score', header: '점수', width: '16%', align: 'center' },
    { key: 'pct', header: '정답률', width: '16%', align: 'center' },
    { key: 'submittedAt', header: '응시일', width: '18%', align: 'center' },
  ]
  const quizRows = quiz.rows.map((r) => ({
    key: r.id,
    label: r.label,
    title: r.title,
    score: `${r.score}/${r.total}`,
    pct: r.pct == null ? '-' : `${r.pct}%`,
    submittedAt: r.submittedAt,
  }))

  const taskColumns = [
    { key: 'title', header: '과제명', width: '40%' },
    { key: 'subject', header: '과목', width: '20%', align: 'center' },
    { key: 'dueDate', header: '기한', width: '22%', align: 'center' },
    { key: 'status', header: '수행 상태', width: '18%', align: 'center' },
  ]
  const taskRows = tasks.rows.map((t) => ({
    key: t.id,
    title: t.title || '-',
    subject: t.subject || '-',
    dueDate: t.dueDate || '-',
    status: t.status === 'done' ? '완료' : '미완료',
  }))

  const feedbackColumns = [
    { key: 'date', header: '날짜', width: '18%', align: 'center' },
    { key: 'authorName', header: '작성자', width: '18%', align: 'center' },
    { key: 'content', header: '내용', width: '64%' },
  ]
  const feedbackRows = feedbacks.map((f) => ({
    key: f.id,
    date: f.date,
    authorName: f.authorName || '-',
    content: f.content,
  }))

  const coachingLines = String(coachingText ?? '').split('\n').filter((l) => l.trim())

  return (
    <Document
      title={`${title} (${generatedAt})`}
      author={author}
      creator={ORG_NAME}
      producer={ORG_NAME}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.orgLine}>
                <Text style={styles.orgName}>{ORG_NAME}</Text>
                {groupName ? <Text style={styles.groupBadge}>{groupName}</Text> : null}
              </View>
              <Text style={styles.bigTitle}>{title}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.studentLine}>
                {student.name ?? '-'}
                {(student.school || student.grade) ? `  ·  ${[student.school, student.grade].filter(Boolean).join(' ')}` : ''}
              </Text>
              <Text style={styles.metaLine}>작성자 {author || '미상'}</Text>
              <Text style={styles.metaLine}>생성일 {generatedAt}</Text>
            </View>
          </View>
          <Text style={styles.periodLine}>
            보고 기간 · <Text style={{ fontWeight: 600 }}>{periodText}</Text>
          </Text>
        </View>

        <KpiGrid items={kpis} columns={4} />
        <View style={{ height: 10 }} />

        <Section title="학습 분포" caption="기간 내 실측 학습시간 기준">
          <View style={styles.chartRow}>
            <View style={styles.chartHalf}>
              <Text style={styles.chartCaption}>과목별 학습시간</Text>
              {study.subjectDist.length > 0 ? (
                <>
                  <ChartImage src={charts.subjectPng} height={150} fallback="차트를 캡처하지 못해 아래 표로 대체합니다." />
                  <View style={{ height: 6 }} />
                  <Table columns={DIST_COLUMNS} rows={distRows(study.subjectDist)} />
                </>
              ) : (
                <Text style={styles.emptyLine}>기간 내 학습 기록이 없습니다.</Text>
              )}
            </View>
            <View style={styles.chartHalf}>
              <Text style={styles.chartCaption}>학습법별 학습시간</Text>
              {study.methodDist.length > 0 ? (
                <>
                  <ChartImage src={charts.methodPng} height={150} fallback="차트를 캡처하지 못해 아래 표로 대체합니다." />
                  <View style={{ height: 6 }} />
                  <Table columns={DIST_COLUMNS} rows={distRows(study.methodDist)} />
                </>
              ) : (
                <Text style={styles.emptyLine}>기간 내 학습 기록이 없습니다.</Text>
              )}
            </View>
          </View>
        </Section>

        <Section title="센터 이용시간" caption="등·하원 기록 기준 (주차별)">
          {usage.weekly.some((w) => w.minutes > 0) ? (
            <ChartImage src={charts.weeklyPng} height={130} fallback="차트를 캡처하지 못했습니다." />
          ) : (
            <Text style={styles.emptyLine}>기간 내 센터 이용 기록이 없습니다.</Text>
          )}
        </Section>

        <Section title="교과 컨설팅" caption={`총 ${consulting.totalSessions}회 · ${formatMinutes(consulting.totalMinutes)}`}>
          {consulting.rows.length > 0 ? (
            <>
              <ChartImage src={charts.consultingPng} height={120} fallback="차트를 캡처하지 못해 아래 표로 대체합니다." />
              <View style={{ height: 6 }} />
              <Table columns={consultingColumns} rows={consultingRows} />
            </>
          ) : (
            <Text style={styles.emptyLine}>기간 내 교과 컨설팅 기록이 없습니다.</Text>
          )}
        </Section>

        <Section title="자기주도 학습 코칭">
          {coachingLines.length > 0 ? (
            <View style={styles.textBlock}>
              {coachingLines.map((line, idx) => (
                <Text key={idx} style={styles.textLine}>{line}</Text>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyLine}>기간 내 코칭 내용이 없습니다.</Text>
          )}
        </Section>

        <Section title="피드백">
          <Table columns={feedbackColumns} rows={feedbackRows} emptyText="기간 내 피드백이 없습니다." />
        </Section>

        <Section title="확인평가" caption={quiz.avgPct == null ? undefined : `평균 정답률 ${quiz.avgPct}%`}>
          <Table columns={quizColumns} rows={quizRows} emptyText="기간 내 확인평가 응시 기록이 없습니다." />
        </Section>

        <Section
          title="과제 내역"
          caption={tasks.total > 0 ? `부여 ${tasks.total}건 · 완료 ${tasks.done}건 (${Math.round((tasks.rate ?? 0) * 100)}%)` : undefined}
        >
          <Table columns={taskColumns} rows={taskRows} emptyText="기간 내 과제가 없습니다." />
        </Section>

        <ReportFooter />
      </Page>
    </Document>
  )
}
