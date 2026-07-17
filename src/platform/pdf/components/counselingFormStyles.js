import { StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize } from '../config/styles'

// 관공서 서식 상담 리포트 공용 스타일 — CounselingFormLayout.jsx와 세트.
// (컴포넌트 파일과 분리: react-refresh/only-export-components)
// ⚠️ 세로 방향 flex:1 금지 — 높이 auto인 컨테이너에서 높이 0으로 붕괴해 내용이
// 겹쳐 찍힌다(Yoga). 셀 높이는 전부 내용 기반, 열은 row stretch로 맞춘다.

const BORDER = 0.8
const line = { borderColor: colors.text, borderStyle: 'solid' }
const RIGHT_COL = '20%' // 누적횟수/특이사항 열 (colMain 기준)

export const formStyles = StyleSheet.create({
  page: {
    fontFamily: 'Pretendard',
    fontSize: fontSize.sm,
    color: colors.text,
    padding: 36,
    lineHeight: 1.35,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 14,
  },

  // ── 상단 헤더 표 ──
  headerTable: { ...line, borderWidth: BORDER, marginBottom: 12 },
  headerRow: { flexDirection: 'row', ...line, borderBottomWidth: BORDER },
  headerRowLast: { borderBottomWidth: 0 },
  headerCell: {
    ...line,
    borderRightWidth: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  headerCellLast: { borderRightWidth: 0 },
  headerLabel: { backgroundColor: colors.bgMuted },
  headerText: { textAlign: 'center' },

  // ── 세부 내용 표 ──
  detailTitleBar: {
    ...line,
    borderWidth: BORDER,
    borderBottomWidth: 0,
    backgroundColor: colors.bgMuted,
    paddingVertical: 4,
  },
  detailTitleText: { textAlign: 'center', fontWeight: 700 },
  // 머리·블록 공통 골격: [번호 7%][좌측 15%][본문 78%]
  block: {
    ...line,
    borderLeftWidth: BORDER,
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    flexDirection: 'row',
    minHeight: 72,
  },
  blockHead: { ...line, borderTopWidth: BORDER, backgroundColor: colors.bgLight, minHeight: 0 },
  colNo: {
    width: '7%',
    ...line,
    borderRightWidth: BORDER,
    justifyContent: 'center',
  },
  colLeft: { width: '15%', ...line, borderRightWidth: BORDER },
  colMain: { width: '78%' },
  centerText: { textAlign: 'center' },
  // 좌측 열: 위/아래 2칸 — 내용 기반 높이
  stackTop: {
    ...line,
    borderBottomWidth: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  stackBottom: { paddingVertical: 4, paddingHorizontal: 2 },
  // 본문 상단 행: 상담일시 + 누적횟수
  rowTop: { flexDirection: 'row', ...line, borderBottomWidth: BORDER },
  dateTimeCell: { flex: 1, paddingVertical: 3, paddingHorizontal: 4, justifyContent: 'center' },
  roundCell: {
    width: RIGHT_COL,
    ...line,
    borderLeftWidth: BORDER,
    paddingVertical: 3,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  // 본문 하단 행: 상담내용 + 특이사항
  rowBody: { flexDirection: 'row', flexGrow: 1 },
  contentCell: { flex: 1, paddingVertical: 4, paddingHorizontal: 6 },
  noteCell: {
    width: RIGHT_COL,
    ...line,
    borderLeftWidth: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  subLabel: { fontWeight: 600, fontSize: fontSize.xs, color: colors.muted, marginBottom: 1 },
  subSection: { minHeight: 16 },
  dashedDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    borderBottomStyle: 'dashed',
    marginVertical: 3,
  },
  emptyBox: {
    ...line,
    borderLeftWidth: BORDER,
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    padding: 16,
  },
  emptyText: { textAlign: 'center', color: colors.muted },
})
