import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize } from '../config/styles'

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardOuter: {
    padding: 4,
  },
  card: {
    padding: 10,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderStyle: 'solid',
    borderRadius: 4,
    backgroundColor: colors.bgLight,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginBottom: 4,
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: 700,
    color: colors.text,
  },
  unit: {
    fontSize: fontSize.sm,
    color: colors.muted,
    fontWeight: 400,
    marginLeft: 2,
  },
})

export default function KpiGrid({ items, columns = 4 }) {
  const widthPct = `${(100 / columns).toFixed(2)}%`
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[styles.cardOuter, { width: widthPct }]}
          wrap={false}
        >
          <View style={styles.card}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.value}>
              {item.value}
              {item.unit && <Text style={styles.unit}> {item.unit}</Text>}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}
