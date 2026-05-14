import { View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize } from '../config/styles'

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 0.5,
    borderColor: colors.borderLight,
    borderStyle: 'solid',
    borderRadius: 4,
    padding: 6,
    backgroundColor: '#ffffff',
  },
  image: {
    width: '100%',
    objectFit: 'contain',
  },
  caption: {
    marginTop: 4,
    fontSize: fontSize.xs,
    color: colors.muted,
    textAlign: 'center',
  },
  fallback: {
    padding: 16,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
  },
})

export default function ChartImage({ src, caption, height = 180, fallback = '차트 캡처 실패' }) {
  return (
    <View style={styles.wrapper} wrap={false}>
      {src ? (
        <Image src={src} style={[styles.image, { height }]} />
      ) : (
        <Text style={styles.fallback}>{fallback}</Text>
      )}
      {caption && <Text style={styles.caption}>{caption}</Text>}
    </View>
  )
}
