import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize, baseStyles } from '../config/styles'

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    borderBottomStyle: 'solid',
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: 700,
    color: colors.text,
  },
  caption: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
})

export default function Section({ title, caption, children, style, wrap = true }) {
  return (
    <View style={[baseStyles.section, style]} wrap={wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {caption && <Text style={styles.caption}>{caption}</Text>}
      </View>
      {children}
    </View>
  )
}
