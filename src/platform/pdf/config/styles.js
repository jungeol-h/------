import { StyleSheet } from '@react-pdf/renderer'

export const colors = {
  text: '#111827',
  muted: '#6b7280',
  subtle: '#9ca3af',
  border: '#d1d5db',
  borderLight: '#e5e7eb',
  bgLight: '#f9fafb',
  bgMuted: '#f3f4f6',
  accentBlue: '#3b82f6',
  accentRed: '#dc2626',
  accentGreen: '#059669',
  accentAmber: '#d97706',
  accentViolet: '#7c3aed',
}

export const fontSize = {
  xs: 9,
  sm: 10,
  base: 11,
  lg: 13,
  xl: 16,
  title: 20,
}

export const spacing = {
  pageMargin: 36,
  pageMarginTop: 84,
  pageMarginBottom: 56,
}

export const baseStyles = StyleSheet.create({
  page: {
    fontFamily: 'Pretendard',
    fontSize: fontSize.base,
    color: colors.text,
    paddingTop: spacing.pageMarginTop,
    paddingBottom: spacing.pageMarginBottom,
    paddingLeft: spacing.pageMargin,
    paddingRight: spacing.pageMargin,
    lineHeight: 1.4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    borderBottomStyle: 'solid',
  },
  textMuted: {
    color: colors.muted,
    fontSize: fontSize.sm,
  },
  bold: {
    fontWeight: 700,
  },
  semibold: {
    fontWeight: 600,
  },
})
