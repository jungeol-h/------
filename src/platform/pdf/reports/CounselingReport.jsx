import { View, Text, StyleSheet } from '@react-pdf/renderer'
import PageWrapper from '../components/PageWrapper'
import Section from '../components/Section'
import Table from '../components/Table'
import { colors, fontSize } from '../config/styles'

// 상담 누적 보고서 — 재원생/외생(외부 학생) 공용.
// DataContext에 의존하지 않고 순수 props만 받는다.
// props: { student: {name, school, grade}, records: [{date, typeLabel, targetLabel?, authorName, content}], generatedAt, author }
// targetLabel(피상담자)은 외생 상담에만 있음 — 하나라도 있으면 '대상' 컬럼 표시.

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

export default function CounselingReport({ student = {}, records = [], generatedAt, author }) {
  const dates = records.map((r) => r.date).filter(Boolean).sort()
  const first = dates[0]
  const last = dates[dates.length - 1]
  const period = first ? (first === last ? first : `${first} ~ ${last}`) : '-'

  const hasTarget = records.some((r) => r.targetLabel)

  const columns = [
    { key: 'date', header: '날짜', width: '12%' },
    { key: 'typeLabel', header: '구분', width: '12%', align: 'center' },
    ...(hasTarget ? [{ key: 'targetLabel', header: '대상', width: '10%', align: 'center' }] : []),
    { key: 'authorName', header: '작성자', width: '14%', align: 'center' },
    { key: 'content', header: '상담 내용', width: hasTarget ? '52%' : '62%' },
  ]

  const rows = records.map((r, idx) => ({
    key: idx,
    date: r.date || '-',
    typeLabel: r.typeLabel || '-',
    ...(hasTarget ? { targetLabel: r.targetLabel || '-' } : {}),
    authorName: r.authorName || '-',
    content: r.content || '-',
  }))

  return (
    <PageWrapper
      reportTitle="상담 누적 보고서"
      period={period}
      generatedAt={generatedAt}
      author={author}
    >
      <Section title="학생 정보">
        <View style={infoStyles.grid}>
          <InfoRow label="이름" value={student.name} />
          <InfoRow label="학교" value={student.school} />
          <InfoRow label="학년" value={student.grade} />
          <InfoRow label="총 상담횟수" value={`${records.length}회`} />
        </View>
      </Section>

      <Section title="상담 이력">
        <Table columns={columns} rows={rows} emptyText="상담 기록이 없습니다." />
      </Section>
    </PageWrapper>
  )
}
