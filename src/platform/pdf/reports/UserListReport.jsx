import { View, Text, StyleSheet } from '@react-pdf/renderer'
import PageWrapper from '../components/PageWrapper'
import Section from '../components/Section'
import Table from '../components/Table'
import { colors, fontSize } from '../config/styles'

const RISK_LABELS = {
  normal: { label: '정상', color: colors.accentGreen, bg: '#dcfce7' },
  warning: { label: '주의', color: colors.accentAmber, bg: '#fef3c7' },
  danger: { label: '위험', color: colors.accentRed, bg: '#fee2e2' },
}
const STATUS_LABELS = {
  active: { label: '활성', color: colors.accentBlue, bg: '#dbeafe' },
  inactive: { label: '비활성', color: colors.muted, bg: '#e5e7eb' },
}
const GENDER_LABELS = { M: '남', F: '여' }
const SORT_LABELS = {
  name: '이름',
  grade: '학년',
  manager: '담당 매니저',
  risk: '위험도',
  selfIndex: '자기주도지수',
}

const filterStyles = StyleSheet.create({
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

const badgeStyles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: fontSize.xs,
    fontWeight: 600,
  },
})

function Badge({ label, color, bg }) {
  return (
    <View
      style={{
        alignSelf: 'center',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
        backgroundColor: bg,
      }}
    >
      <Text style={[badgeStyles.badge, { color, backgroundColor: 'transparent' }]}>
        {label}
      </Text>
    </View>
  )
}

function FilterRow({ label, value }) {
  return (
    <View style={filterStyles.item}>
      <Text style={filterStyles.label}>{label}</Text>
      <Text style={filterStyles.value}>{value || '-'}</Text>
    </View>
  )
}

export default function UserListReport({
  students,
  managerNameOf,
  filters,
  period,
  generatedAt,
  author,
}) {
  const { showInactive, query, sortKey, sortDir } = filters || {}
  const dirLabel = sortDir === 'desc' ? '내림차순' : '오름차순'
  const sortLabel = `${SORT_LABELS[sortKey] || sortKey} · ${dirLabel}`

  const columns = [
    { key: 'idx', header: '순번', width: '6%', align: 'center' },
    { key: 'name', header: '이름', width: '12%' },
    { key: 'gender', header: '성별', width: '6%', align: 'center' },
    { key: 'school', header: '학교', width: '20%' },
    { key: 'grade', header: '학년', width: '8%', align: 'center' },
    { key: 'className', header: '반', width: '8%', align: 'center' },
    { key: 'manager', header: '담당 매니저', width: '12%', align: 'center' },
    { key: 'risk', header: '위험도', width: '10%', align: 'center' },
    { key: 'selfIndex', header: '자기주도지수', width: '10%', align: 'right' },
    { key: 'status', header: '상태', width: '8%', align: 'center' },
  ]

  const rows = students.map((s, idx) => {
    const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
    const status = STATUS_LABELS[s.status || 'active'] || STATUS_LABELS.active
    return {
      key: s.id,
      idx: idx + 1,
      name: s.name || '-',
      gender: s.gender ? GENDER_LABELS[s.gender] : '-',
      school: s.school || '-',
      grade: s.grade || '-',
      className: s.className || '-',
      manager: managerNameOf(s.id) || '미배정',
      risk: <Badge label={risk.label} color={risk.color} bg={risk.bg} />,
      selfIndex: `${s.selfIndex ?? '-'}점`,
      status: <Badge label={status.label} color={status.color} bg={status.bg} />,
    }
  })

  const danger = students.filter((s) => s.riskLevel === 'danger').length
  const warning = students.filter((s) => s.riskLevel === 'warning').length
  const inactive = students.filter((s) => s.status === 'inactive').length

  return (
    <PageWrapper
      reportTitle="학생 목록 보고서"
      period={period}
      generatedAt={generatedAt}
      author={author}
    >
      <Section title="조회 조건">
        <View style={filterStyles.grid}>
          <FilterRow
            label="표시 범위"
            value={showInactive ? '전체 (활성 + 비활성)' : '활성 학생만'}
          />
          <FilterRow label="검색어" value={query ? `"${query}"` : '(없음)'} />
          <FilterRow label="정렬" value={sortLabel} />
          <FilterRow label="총 건수" value={`${students.length}명`} />
          <FilterRow
            label="위험도 분포"
            value={`위험 ${danger}명 · 주의 ${warning}명`}
          />
          <FilterRow
            label="비활성 인원"
            value={`${inactive}명`}
          />
        </View>
      </Section>

      <Section title="학생 목록">
        <Table columns={columns} rows={rows} />
      </Section>
    </PageWrapper>
  )
}
