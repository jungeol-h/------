import { View, Text } from '@react-pdf/renderer'
import PageWrapper from '../components/PageWrapper'
import Section from '../components/Section'
import Table from '../components/Table'
import { InfoGrid, InfoRow } from '../components/InfoGrid'
import { colors, fontSize } from '../config/styles'
import { examKeyLabel } from '../../utils/examTerms.js'
import { nowDateTime } from '../utils/formatters.js'

const SATISFACTION = ['매우 불만족', '불만족', '보통', '만족', '매우 만족']

const has = (v) => v !== null && v !== undefined && v !== ''
const fmtScore = (v) => (has(v) ? String(v) : '-')

function fmtDiff(prev, score) {
  if (!has(prev) || !has(score)) return '-'
  const d = Number(score) - Number(prev)
  if (Number.isNaN(d)) return '-'
  if (d > 0) return `+${d}`
  if (d < 0) return `−${Math.abs(d)}`
  return '0'
}

const columns = [
  { key: 'subject', header: '과목', width: '16%' },
  { key: 'prev', header: '지난시험', width: '12%', align: 'center' },
  { key: 'target', header: '목표', width: '10%', align: 'center' },
  { key: 'score', header: '이번시험', width: '12%', align: 'center' },
  { key: 'diff', header: '증감', width: '10%', align: 'center' },
  { key: 'perf', header: '수행평가', width: '20%', align: 'center' },
  { key: 'sat', header: '만족도', width: '20%', align: 'center' },
]

// 내신 피드백 보고서 (학생 × 시험 1건) — 순수 props. 페이지번호 render 콜백 금지(pdf/README).
export default function ExamFeedbackReport({ feedback, studentName, generatedAt, author }) {
  const subjects = feedback?.subjects ?? []
  const label = examKeyLabel(feedback)

  const rows = subjects.map((s, i) => ({
    key: `${s.subject}-${i}`,
    subject: s.subject || '-',
    prev: fmtScore(s.prevScore),
    target: fmtScore(s.targetScore),
    score: fmtScore(s.score),
    diff: fmtDiff(s.prevScore, s.score),
    perf: has(s.perfScore) && has(s.perfMax) ? `${s.perfScore} / ${s.perfMax}` : '-',
    sat: SATISFACTION[(s.satisfaction ?? 0) - 1] ?? '-',
  }))

  const comments = subjects.filter((s) => (s.good ?? '').trim() || (s.improve ?? '').trim())
  const updated = [feedback?.updatedByName, (feedback?.updatedAt || '').slice(0, 10)].filter(Boolean).join(' · ')

  return (
    <PageWrapper
      reportTitle="내신 피드백 보고서"
      period={label}
      generatedAt={generatedAt ?? nowDateTime()}
      author={author ?? feedback?.updatedByName ?? ''}
    >
      <Section title="기본 정보">
        <InfoGrid>
          <InfoRow label="학생 이름" value={studentName} />
          <InfoRow label="학교" value={feedback?.school} />
          <InfoRow label="학년·반" value={[...new Set([feedback?.grade, feedback?.className].filter(Boolean))].join(' ')} />
          <InfoRow label="작성일" value={feedback?.writtenDate} />
          <InfoRow label="최종 수정" value={updated} />
        </InfoGrid>
      </Section>

      <Section title="01 점수 비교와 성적 만족도">
        <Table columns={columns} rows={rows} emptyText="입력된 과목이 없습니다." />
        {comments.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {comments.map((s, i) => (
              <View key={`${s.subject}-${i}`} style={{ marginBottom: 8 }} minPresenceAhead={40}>
                <Text style={{ fontSize: fontSize.sm, fontWeight: 700, color: colors.text, marginBottom: 2 }}>
                  {s.subject}
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.text, lineHeight: 1.5 }}>
                  잘한 점: {(s.good ?? '').trim() || '-'}
                </Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.text, lineHeight: 1.5 }}>
                  개선할 점: {(s.improve ?? '').trim() || '-'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="02 다음 시험을 위한 핵심 실천과제">
        <Text style={{ fontSize: fontSize.sm, color: colors.text, lineHeight: 1.6 }}>
          {(feedback?.actionPlan ?? '').trim() || '-'}
        </Text>
      </Section>
    </PageWrapper>
  )
}
