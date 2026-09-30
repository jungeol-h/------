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
  active: { label: '재원', color: colors.accentBlue, bg: '#dbeafe' },
  cancelled: { label: '신청취소', color: colors.accentAmber, bg: '#fef3c7' },
  withdrawn: { label: '퇴원', color: colors.muted, bg: '#e5e7eb' },
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

// 'YYYY-MM-DD' → 'YY.MM.DD' (Date 객체·toISOString 미사용 — dateUtils.js 문자열 규약 그대로 표기만 축약)
function shortDate(dateStr) {
  if (!dateStr) return ''
  return dateStr.slice(2).replace(/-/g, '.')
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
  const { showInactive, query, sortKey, sortDir, group } = filters || {}
  const dirLabel = sortDir === 'desc' ? '내림차순' : '오름차순'
  const sortLabel = `${SORT_LABELS[sortKey] || sortKey} · ${dirLabel}`
  // 그룹별로 여러 부를 뽑을 때 어느 그룹의 명단인지 문서 자체로 구분되게 한다.
  const groupLabel = !group || group === 'all' ? '전체 그룹' : group

  // '전체 그룹' 출력에서는 행만 봐서 소속을 알 수 없으므로 그룹 컬럼을 추가한다
  // (특정 그룹 출력이면 전 행이 같은 값이라 넣지 않고 학교 칸을 넓게 쓴다).
  const showGroupColumn = !group || group === 'all'
  const dateCellStyle = { fontSize: fontSize.xs }
  const columns = [
    { key: 'idx', header: '순번', width: '5%', align: 'center' },
    { key: 'name', header: '이름', width: showGroupColumn ? '9%' : '10%' },
    { key: 'gender', header: '성별', width: '5%', align: 'center' },
    ...(showGroupColumn ? [{ key: 'group', header: '소속 그룹', width: '10%' }] : []),
    { key: 'school', header: '학교', width: showGroupColumn ? '11%' : '15%' },
    { key: 'grade', header: '학년', width: showGroupColumn ? '5%' : '6%', align: 'center' },
    { key: 'className', header: '반', width: showGroupColumn ? '5%' : '6%', align: 'center' },
    { key: 'manager', header: '매니저', width: showGroupColumn ? '8%' : '9%', align: 'center' },
    { key: 'risk', header: '위험도', width: showGroupColumn ? '7%' : '8%', align: 'center' },
    { key: 'selfIndex', header: '지수', width: showGroupColumn ? '7%' : '8%', align: 'right' },
    {
      key: 'enrolledAt', header: '입학일', width: '10%', align: 'center', cellStyle: dateCellStyle,
    },
    {
      key: 'statusDate', header: '퇴원·취소일', width: '10%', align: 'center', cellStyle: dateCellStyle,
    },
    { key: 'status', header: '상태', width: '8%', align: 'center' },
  ]

  const rows = students.map((s, idx) => {
    const risk = RISK_LABELS[s.riskLevel] || RISK_LABELS.normal
    const status = STATUS_LABELS[s.status || 'active'] || STATUS_LABELS.active
    // 퇴원·취소일은 현재 상태와 일치하는 날짜만 표시 — 재원 복구 후에도 남아있는
    // 옛 날짜(setStudentStatus 정책상 지우지 않음)가 재원생에게 뜨는 걸 막는다.
    const statusDate = s.status === 'withdrawn' || s.status === 'inactive'
      ? s.withdrawnAt
      : s.status === 'cancelled'
        ? s.cancelledAt
        : null
    return {
      key: s.id,
      idx: idx + 1,
      name: s.name || '-',
      gender: s.gender ? GENDER_LABELS[s.gender] : '-',
      group: (s.groups ?? []).join(', ') || '무소속',
      school: s.school || '-',
      grade: s.grade || '-',
      className: s.className || '-',
      manager: managerNameOf(s.id) || '미배정',
      risk: <Badge label={risk.label} color={risk.color} bg={risk.bg} />,
      selfIndex: `${s.selfIndex ?? '-'}점`,
      enrolledAt: shortDate(s.enrolledAt),
      statusDate: shortDate(statusDate),
      status: <Badge label={status.label} color={status.color} bg={status.bg} />,
    }
  })

  const danger = students.filter((s) => s.riskLevel === 'danger').length
  const warning = students.filter((s) => s.riskLevel === 'warning').length
  const inactive = students.filter((s) => (s.status ?? 'active') !== 'active').length

  return (
    <PageWrapper
      reportTitle={`학생 목록 보고서 — ${groupLabel}`}
      period={period}
      generatedAt={generatedAt}
      author={author}
    >
      <Section title="조회 조건">
        <View style={filterStyles.grid}>
          <FilterRow label="소속 그룹" value={groupLabel} />
          <FilterRow
            label="표시 범위"
            value={showInactive ? '전체 (재원 + 퇴원·취소)' : '재원 학생만'}
          />
          <FilterRow label="검색어" value={query ? `"${query}"` : '(없음)'} />
          <FilterRow label="정렬" value={sortLabel} />
          <FilterRow label="총 건수" value={`${students.length}명`} />
          <FilterRow
            label="위험도 분포"
            value={`위험 ${danger}명 · 주의 ${warning}명`}
          />
          <FilterRow
            label="재원 외 인원"
            value={`${inactive}명`}
          />
        </View>
      </Section>

      <Section title={`학생 목록 (${groupLabel})`}>
        <Table columns={columns} rows={rows} />
      </Section>
    </PageWrapper>
  )
}
