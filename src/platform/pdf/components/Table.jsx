import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize } from '../config/styles'

const styles = StyleSheet.create({
  table: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderStyle: 'solid',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgMuted,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    borderBottomStyle: 'solid',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderLight,
    borderBottomStyle: 'solid',
  },
  rowAlt: {
    backgroundColor: colors.bgLight,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  cellHeader: {
    padding: 5,
    fontSize: fontSize.xs,
    fontWeight: 700,
    color: colors.text,
  },
  cell: {
    padding: 5,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  cellDivider: {
    borderRightWidth: 0.5,
    borderRightColor: colors.borderLight,
    borderRightStyle: 'solid',
  },
  emptyText: {
    padding: 8,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
  },
})

export default function Table({
  columns,
  rows,
  zebra = true,
  emptyText = '표시할 데이터가 없습니다.',
}) {
  if (!rows || rows.length === 0) {
    return (
      <View style={styles.table}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    )
  }

  return (
    <View style={styles.table}>
      <View style={styles.headerRow} fixed>
        {columns.map((col, idx) => {
          const cellStyle = [{ width: col.width, flexBasis: col.width }]
          if (idx < columns.length - 1) cellStyle.push(styles.cellDivider)
          return (
            <View key={col.key} style={cellStyle}>
              <Text
                style={[
                  styles.cellHeader,
                  { textAlign: col.align || 'left' },
                ]}
              >
                {col.header}
              </Text>
            </View>
          )
        })}
      </View>
      {rows.map((row, rIdx) => {
        const rowStyle = [styles.row]
        if (zebra && rIdx % 2 === 1) rowStyle.push(styles.rowAlt)
        if (rIdx === rows.length - 1) rowStyle.push(styles.rowLast)
        return (
          <View key={row.key ?? rIdx} style={rowStyle} wrap={false}>
            {columns.map((col, cIdx) => {
              const raw = typeof col.accessor === 'function' ? col.accessor(row, rIdx) : row[col.key]
              const isNode = raw != null && typeof raw === 'object' && '$$typeof' in raw
              const cellWrap = [{ width: col.width, flexBasis: col.width }]
              if (cIdx < columns.length - 1) cellWrap.push(styles.cellDivider)
              return (
                <View key={col.key} style={cellWrap}>
                  {isNode ? (
                    <View style={[styles.cell, { textAlign: col.align || 'left' }]}>
                      {raw}
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.cell,
                        { textAlign: col.align || 'left' },
                        col.cellStyle,
                      ].filter(Boolean)}
                    >
                      {raw == null || raw === '' ? '-' : String(raw)}
                    </Text>
                  )}
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}
