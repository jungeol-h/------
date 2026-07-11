import { View, Text, StyleSheet } from '@react-pdf/renderer'
import PageWrapper from '../components/PageWrapper'
import Section from '../components/Section'
import Table from '../components/Table'
import KpiGrid from '../components/KpiGrid'
import { colors, fontSize } from '../config/styles'

// 종합 성장 리포트 — 출결·자기주도 학습·과제수행·확인평가·마인드 종합.
// DataContext에 의존하지 않고 순수 props만 받는다.
// props: {
//   student: { name, school, grade },
//   attendance: { counts: { present, late, earlyLeave, absent }, records: [{ date, status, checkoutStatus, checkInAt, checkOutAt }] },
//   learning: { totalMinutes, selfIndex, weekly: [{ label, minutes }] },
//   tasks: { total, done, rate, recent: [{ id, title, subject, dueDate, status }] },
//   quiz: { rows: [{ id, label, title, score, total, pct, submittedAt }], avgPct },
//   mind: { avgMood, avgMotivation, avgConfidence, stability, recentCount },
//   generatedAt, author,
// }

const infoStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  item: {
    width: '50%',
    paddingHorizontal: 4,
    paddingVertical: 2,
    flexDirection: 'row',
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.muted,
    width: 78,
  },
  value: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: 600,
    flex: 1,
  },
})

function InfoRow({ label, value }) {
  return (
    <View style={infoStyles.item}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value || '-'}</Text>
    </View>
  )
}

const STATUS_LABEL = { present: '출석', late: '지각', absent: '결석' }

// timestamptz(ISO) → 'HH:MM'. 없거나 파싱 불가면 '—'.
function toHM(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatMinutes(min) {
  const m = Number(min) || 0
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h > 0) return `${h}시간 ${r}분`
  return `${r}분`
}

function statusText(status, checkoutStatus) {
  const base = STATUS_LABEL[status] || status || '-'
  return checkoutStatus === 'early_leave' ? `${base} (조퇴)` : base
}

export default function ReflectionReport({
  student = {},
  attendance = { counts: {}, records: [] },
  learning = {},
  tasks = {},
  quiz = {},
  mind = {},
  generatedAt,
  author,
}) {
  const counts = attendance.counts || {}
  const attRecords = attendance.records || []

  // 출결 이력은 최근 60일치까지만 (records는 날짜 내림차순 정렬 가정)
  const dates = attRecords.map((r) => r.date).filter(Boolean)
  const firstDate = dates[dates.length - 1]
  const lastDate = dates[0]
  const period = lastDate
    ? (firstDate === lastDate ? lastDate : `${firstDate} ~ ${lastDate}`)
    : '-'

  const attColumns = [
    { key: 'date', header: '날짜', width: '25%' },
    { key: 'status', header: '상태', width: '25%', align: 'center' },
    { key: 'checkIn', header: '등원', width: '25%', align: 'center' },
    { key: 'checkOut', header: '하원', width: '25%', align: 'center' },
  ]
  const attRows = attRecords.slice(0, 60).map((r, idx) => ({
    key: r.id ?? idx,
    date: r.date || '-',
    status: statusText(r.status, r.checkoutStatus),
    checkIn: toHM(r.checkInAt),
    checkOut: toHM(r.checkOutAt),
  }))

  const attKpis = [
    { label: '출석', value: counts.present ?? 0, unit: '회' },
    { label: '지각', value: counts.late ?? 0, unit: '회' },
    { label: '조퇴', value: counts.earlyLeave ?? 0, unit: '회' },
    { label: '결석', value: counts.absent ?? 0, unit: '회' },
  ]

  const weekly = learning.weekly || []
  const weeklyColumns = [
    { key: 'label', header: '주', width: '50%' },
    { key: 'minutes', header: '학습시간', width: '50%', align: 'center' },
  ]
  const weeklyRows = weekly.map((w, idx) => ({
    key: idx,
    label: w.label,
    minutes: formatMinutes(w.minutes),
  }))

  const fmtScore = (v) => (v == null ? '-' : String(v))
  const fmtAvg = (v) => (v == null ? '-' : Number(v).toFixed(1))

  // 과제수행 — 요약 KPI + 최근 과제 목록
  const taskRecent = tasks.recent || []
  const taskColumns = [
    { key: 'title', header: '과제명', width: '40%' },
    { key: 'subject', header: '과목', width: '20%', align: 'center' },
    { key: 'dueDate', header: '기한', width: '22%', align: 'center' },
    { key: 'status', header: '상태', width: '18%', align: 'center' },
  ]
  const taskRows = taskRecent.map((t) => ({
    key: t.id,
    title: t.title || '-',
    subject: t.subject || '-',
    dueDate: t.dueDate || '-',
    status: t.status === 'done' ? '완료' : '미완료',
  }))
  const taskKpis = [
    { label: '부여 과제', value: tasks.total ?? 0, unit: '건' },
    { label: '완료', value: tasks.done ?? 0, unit: '건' },
    { label: '이행률', value: tasks.rate == null ? '-' : Math.round(tasks.rate * 100), unit: tasks.rate == null ? '' : '%' },
  ]

  // 확인평가 결과 — 응시별 점수·정답률
  const quizRows = (quiz.rows || []).map((r) => ({
    key: r.id,
    label: r.label,
    title: r.title,
    score: `${r.score}/${r.total}`,
    pct: r.pct == null ? '-' : `${r.pct}%`,
    submittedAt: r.submittedAt,
  }))
  const quizColumns = [
    { key: 'label', header: '회차', width: '20%' },
    { key: 'title', header: '평가명', width: '30%' },
    { key: 'score', header: '점수', width: '16%', align: 'center' },
    { key: 'pct', header: '정답률', width: '16%', align: 'center' },
    { key: 'submittedAt', header: '응시일', width: '18%', align: 'center' },
  ]

  return (
    <PageWrapper
      reportTitle="종합 성장 리포트"
      period={period}
      generatedAt={generatedAt}
      author={author}
    >
      <Section title="학생 정보">
        <View style={infoStyles.grid}>
          <InfoRow label="이름" value={student.name} />
          <InfoRow label="학교" value={student.school} />
          <InfoRow label="학년" value={student.grade} />
        </View>
      </Section>

      <Section title="출결 요약">
        <KpiGrid items={attKpis} columns={4} />
        <View style={{ height: 8 }} />
        <Table columns={attColumns} rows={attRows} emptyText="출결 기록이 없습니다." />
      </Section>

      <Section title="자기주도 학습">
        <View style={infoStyles.grid}>
          <InfoRow label="자기주도지수" value={learning.selfIndex == null ? '-' : `${learning.selfIndex}점`} />
          <InfoRow label="총 학습시간" value={formatMinutes(learning.totalMinutes)} />
        </View>
        <View style={{ height: 8 }} />
        <Table columns={weeklyColumns} rows={weeklyRows} emptyText="주별 학습 기록이 없습니다." />
      </Section>

      <Section title="과제 수행">
        <KpiGrid items={taskKpis} columns={3} />
        <View style={{ height: 8 }} />
        <Table columns={taskColumns} rows={taskRows} emptyText="부여된 과제가 없습니다." />
      </Section>

      <Section title="확인평가 결과">
        <View style={infoStyles.grid}>
          <InfoRow label="평균 정답률" value={quiz.avgPct == null ? '-' : `${quiz.avgPct}%`} />
          <InfoRow label="응시 횟수" value={`${quizRows.length}회`} />
        </View>
        <View style={{ height: 8 }} />
        <Table columns={quizColumns} rows={quizRows} emptyText="확인평가 응시 기록이 없습니다." />
      </Section>

      <Section title="마인드">
        <View style={infoStyles.grid}>
          <InfoRow label="평균 기분" value={fmtAvg(mind.avgMood)} />
          <InfoRow label="평균 동기" value={fmtAvg(mind.avgMotivation)} />
          <InfoRow label="평균 자신감" value={fmtAvg(mind.avgConfidence)} />
          <InfoRow label="정서 안정도" value={mind.stability == null ? '-' : `${fmtScore(mind.stability)}점`} />
          <InfoRow label="기록 수" value={`${mind.recentCount ?? 0}건`} />
        </View>
      </Section>
    </PageWrapper>
  )
}
