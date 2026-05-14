import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize, spacing } from '../config/styles'
import { ORG_NAME } from '../config/meta'

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: spacing.pageMargin / 2,
    left: spacing.pageMargin,
    right: spacing.pageMargin,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: colors.borderLight,
    borderTopStyle: 'solid',
  },
  text: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
})

export default function ReportFooter() {
  return (
    <View style={styles.wrapper} fixed>
      <Text style={styles.text}>{ORG_NAME} · 상위자 보고용 문서</Text>
      <Text
        style={styles.text}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}
