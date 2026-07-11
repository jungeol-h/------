// 라벨-값 2열 그리드 — 리포트 상단 기본 정보(이름/학교/학년 등) 공용.
// <InfoGrid><InfoRow label value /></InfoGrid> 형태로 사용한다.
import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize } from '../config/styles'

const styles = StyleSheet.create({
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

export function InfoGrid({ children }) {
  return <View style={styles.grid}>{children}</View>
}

export function InfoRow({ label, value }) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '-'}</Text>
    </View>
  )
}
