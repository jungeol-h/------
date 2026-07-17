import { StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize } from '../config/styles'

// 관공서 서식 상담 리포트 공용 스타일 — CounselingFormLayout.jsx와 세트.
// (컴포넌트 파일과 분리: react-refresh/only-export-components)
// ⚠️ 세로 방향 flex:1 금지 — 높이 auto인 컨테이너에서 높이 0으로 붕괴해 내용이
// 겹쳐 찍힌다(Yoga). 셀 높이는 전부 내용 기반, 열은 row stretch로 맞춘다.
// 가로 구분선은 행(rowTop)의 borderBottom 하나로만 긋는다 — 열마다 따로 그으면
// 패딩 차이만큼 어긋난다.

const BORDER = 0.8
const line = { borderColor: colors.text, borderStyle: 'solid' }
const LEFT_COL = '16%' // 학생이름/학교학년 열 (colBody 기준)
const RIGHT_COL = '17%' // 누적횟수/특이사항 열 (colBody 기준)

export const formStyles = StyleSheet.create({
  page: {
    fontFamily: 'Pretendard',
    fontSize: fontSize.sm,
    color: colors.text,
    padding: 36,
    lineHeight: 1.35,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  titleLogo: { width: 70, height: 22, marginRight: 10 },
  titleText: {
    fontSize: fontSize.title,
    fontWeight: 700,
    textAlign: 'center',
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
  // 머리·블록 공통 골격: [번호 7%][본문 93% = 상단행/하단행]
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
  colBody: { width: '93%' },
  centerText: { textAlign: 'center' },
  // 본문 상단 행: 이름 + 상담일시 + 누적횟수 — 구분선은 이 행의 borderBottom 하나뿐
  rowTop: { flexDirection: 'row', ...line, borderBottomWidth: BORDER },
  leftTopCell: {
    width: LEFT_COL,
    ...line,
    borderRightWidth: BORDER,
    paddingVertical: 3,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  dateTimeCell: { flex: 1, paddingVertical: 3, paddingHorizontal: 4, justifyContent: 'center' },
  roundCell: {
    width: RIGHT_COL,
    ...line,
    borderLeftWidth: BORDER,
    paddingVertical: 3,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  // 본문 하단 행: 학교학년 + 상담내용 + 특이사항
  rowBody: { flexDirection: 'row', flexGrow: 1 },
  leftBottomCell: {
    width: LEFT_COL,
    ...line,
    borderRightWidth: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
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
