import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize, spacing } from '../config/styles'
import { ORG_NAME, ORG_SUBTITLE } from '../config/meta'

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: spacing.pageMargin,
    left: spacing.pageMargin,
    right: spacing.pageMargin,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
    borderBottomStyle: 'solid',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  leftCol: {
    flexDirection: 'column',
  },
  orgLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  orgName: {
    fontSize: fontSize.lg,
    fontWeight: 700,
    color: colors.text,
  },
  orgSubtitle: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginLeft: 6,
  },
  reportTitle: {
    fontSize: fontSize.xl,
    fontWeight: 700,
    color: colors.text,
    marginTop: 2,
  },
  rightCol: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  metaLine: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginBottom: 1,
  },
  metaValue: {
    color: colors.text,
    fontWeight: 600,
  },
  periodLine: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.text,
  },
})

export default function ReportHeader({ reportTitle, period, generatedAt, author }) {
  return (
    <View style={styles.wrapper} fixed>
      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          <View style={styles.orgLine}>
            <Text style={styles.orgName}>{ORG_NAME}</Text>
            <Text style={styles.orgSubtitle}>{ORG_SUBTITLE}</Text>
          </View>
          <Text style={styles.reportTitle}>{reportTitle}</Text>
        </View>
        <View style={styles.rightCol}>
          <Text style={styles.metaLine}>
            작성자 <Text style={styles.metaValue}>{author || '미상'}</Text>
          </Text>
          <Text style={styles.metaLine}>
            생성일 <Text style={styles.metaValue}>{generatedAt}</Text>
          </Text>
        </View>
      </View>
      {period && (
        <Text style={styles.periodLine}>
          보고 기간 · <Text style={{ fontWeight: 600 }}>{period}</Text>
        </Text>
      )}
    </View>
  )
}
