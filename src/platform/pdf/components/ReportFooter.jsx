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

// 페이지 번호(render 콜백) 금지 — @react-pdf 4.5.1에서 다중 페이지 문서 +
// 동적 render 콜백 조합이 "unsupported number" 크래시를 일으킨다 (확인평가 보고서에서 재현).
export default function ReportFooter() {
  return (
    <View style={styles.wrapper} fixed>
      <Text style={styles.text}>{ORG_NAME} · 상위자 보고용 문서</Text>
    </View>
  )
}
