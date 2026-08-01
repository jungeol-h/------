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
// 2026-08 개편(페이지 수 최소화, 클라 확정): 칼럼 헤더 없이 건마다
// [번호][메타 한 줄(음영: 대상 · 일시 · 회차) / 본문 전체 폭] 블록 구조.

// 2026-08 압축 개편: 클라이언트 요청 "페이지 수 최소화" — 여백·최소높이·폰트를
// 줄이고 내용 라벨은 본문과 한 줄로 병기(EntryBlock). 서식 골격은 유지.
export const formStyles = StyleSheet.create({
  page: {
    fontFamily: 'Pretendard',
    fontSize: fontSize.xs,
    color: colors.text,
    padding: 26,
    lineHeight: 1.25,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  titleLogo: { width: 56, height: 18, marginRight: 8 },
  titleText: {
    fontSize: fontSize.xl,
    fontWeight: 700,
    textAlign: 'center',
  },

  // ── 상단 헤더 표 ──
  headerTable: { ...line, borderWidth: BORDER, marginBottom: 8 },
  headerRow: { flexDirection: 'row', ...line, borderBottomWidth: BORDER },
  headerRowLast: { borderBottomWidth: 0 },
  headerCell: {
    ...line,
    borderRightWidth: BORDER,
    paddingVertical: 4,
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
    backgroundColor: colors.bgMuted,
    paddingVertical: 3,
  },
  detailTitleText: { textAlign: 'center', fontWeight: 700 },
  // 블록 골격: [번호 5%][본문 95% = 메타줄/내용]
  block: {
    ...line,
    borderLeftWidth: BORDER,
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    flexDirection: 'row',
    minHeight: 24,
  },
  colNo: {
    width: '5%',
    ...line,
    borderRightWidth: BORDER,
    justifyContent: 'center',
  },
  colBody: { width: '95%' },
  centerText: { textAlign: 'center' },
  // 메타줄: 대상(학교·인원) · 일시 · 회차 — 음영 한 줄
  metaRow: {
    ...line,
    borderBottomWidth: BORDER,
    backgroundColor: colors.bgLight,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  metaText: { fontWeight: 600 },
  // 본문: 전체 폭 (특이사항도 인라인 섹션으로). ⚠️ 세로 컨테이너라 flex:1 금지 — 내용 기반 높이.
  contentCell: { paddingVertical: 3, paddingHorizontal: 5 },
  // 본문과 한 줄 병기하는 인라인 라벨 (중첩 Text)
  subLabel: { fontWeight: 700, fontSize: 8, color: colors.muted },
  subSection: {},
  dashedDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    borderBottomStyle: 'dashed',
    marginVertical: 2,
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
