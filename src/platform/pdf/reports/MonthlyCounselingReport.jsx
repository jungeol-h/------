import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { colors, fontSize } from '../config/styles'

// 강사별 월간 컨설팅 보고서 — docs/보고서 양식.pdf 재현 (관공서 제출용 서식).
// 재원생/외부 상담 공용. DataContext에 의존하지 않고 순수 props만 받는다.
// props:
//   header: { managerName, periodText, duty, schedule, totalCount }
//   entries: [{ no, studentName, schoolGrade, dateTimeText, cumulativeText,
//               topic, diagnosis, advice, followUp, fallbackContent, note }]
//             — selectors/monthlyCounselingReport.js buildMonthlyCounselingEntries 산출물.
//
// 페이지 분할: 세부내용 머리(View fixed)가 모든 페이지 상단에 반복되고, 각 상담 건
// 블록은 wrap={false}로 건 경계에서만 나뉜다 (components/Table.jsx의 검증된 패턴).
// 테두리는 머리가 4변, 블록이 좌/우/하 3변만 가져 페이지 경계에서도 이중선이 없다.
// 한계: 상담 1건이 A4 한 장을 넘으면 wrap={false}가 깨져 넘칠 수 있다(실사용상 비발생 전제).
// 양식 서식이라 브랜드 헤더(PageWrapper)는 쓰지 않는다. 페이지번호 render 콜백 금지(pdf/README.md).

const BORDER = 0.8
const line = { borderColor: colors.text, borderStyle: 'solid' }
const RIGHT_COL = '20%' // 누적횟수/특이사항 열 (colMain 기준)

const styles = StyleSheet.create({
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
  // 머리·블록 공통 골격: [번호 7%][학생 15%][본문 78%]
  // 주의: 세로 방향 flex:1 금지 — 높이 auto인 컨테이너에서 높이 0으로 붕괴해
  // 내용이 겹쳐 찍힌다(Yoga). 셀 높이는 전부 내용 기반, 열은 row stretch로 맞춘다.
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
  colStudent: { width: '15%', ...line, borderRightWidth: BORDER },
  colMain: { width: '78%' },
  centerText: { textAlign: 'center' },
  // 좌측 학생 열: 위(이름)/아래(학교학년) 2칸 — 내용 기반 높이
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

function HeaderTable({ header }) {
  const { managerName, periodText, duty, schedule, totalCount } = header
  const cell = (width, text, { label = false, last = false } = {}) => (
    <View
      style={[
        styles.headerCell,
        { width },
        label && styles.headerLabel,
        last && styles.headerCellLast,
      ].filter(Boolean)}
    >
      <Text style={styles.headerText}>{text}</Text>
    </View>
  )
  return (
    <View style={styles.headerTable}>
      <View style={styles.headerRow}>
        {cell('10%', '담당자', { label: true })}
        {cell('30%', managerName)}
        {cell('10%', '작성기간', { label: true })}
        {cell('50%', periodText, { last: true })}
      </View>
      <View style={[styles.headerRow, styles.headerRowLast]}>
        {cell('10%', '담당업무', { label: true })}
        {cell('30%', duty)}
        {cell('10%', '업무일정', { label: true })}
        {cell('30%', schedule)}
        {cell('8%', '시수', { label: true })}
        {cell('12%', `총 ${totalCount}회`, { last: true })}
      </View>
    </View>
  )
}

// 세부내용 표 머리 — fixed로 모든 페이지 상단에 반복
function DetailHead() {
  return (
    <View fixed>
      <View style={styles.detailTitleBar}>
        <Text style={styles.detailTitleText}>세부 내용</Text>
      </View>
      <View style={[styles.block, styles.blockHead]}>
        <View style={styles.colNo}>
          <Text style={styles.centerText}>번호</Text>
        </View>
        <View style={styles.colStudent}>
          <View style={styles.stackTop}>
            <Text style={styles.centerText}>학생이름</Text>
          </View>
          <View style={styles.stackBottom}>
            <Text style={styles.centerText}>학교학년</Text>
          </View>
        </View>
        <View style={styles.colMain}>
          <View style={styles.rowTop}>
            <View style={styles.dateTimeCell}>
              <Text style={styles.centerText}>상담일시(상담시간)</Text>
            </View>
            <View style={styles.roundCell}>
              <Text style={styles.centerText}>누적횟수</Text>
            </View>
          </View>
          <View style={styles.rowBody}>
            <View style={[styles.contentCell, { justifyContent: 'center' }]}>
              <Text style={styles.centerText}>상담내용</Text>
            </View>
            <View style={[styles.noteCell, { justifyContent: 'center' }]}>
              <Text style={styles.centerText}>특이사항</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

function EntryBlock({ entry }) {
  return (
    <View style={styles.block} wrap={false}>
      <View style={styles.colNo}>
        <Text style={styles.centerText}>{entry.no}</Text>
      </View>
      <View style={styles.colStudent}>
        <View style={styles.stackTop}>
          <Text style={styles.centerText}>{entry.studentName}</Text>
        </View>
        <View style={styles.stackBottom}>
          <Text style={styles.centerText}>{entry.schoolGrade || ' '}</Text>
        </View>
      </View>
      <View style={styles.colMain}>
        <View style={styles.rowTop}>
          <View style={styles.dateTimeCell}>
            <Text style={styles.centerText}>{entry.dateTimeText}</Text>
          </View>
          <View style={styles.roundCell}>
            <Text style={styles.centerText}>{entry.cumulativeText}</Text>
          </View>
        </View>
        <View style={styles.rowBody}>
          <View style={styles.contentCell}>
            {entry.fallbackContent ? (
              <Text>{entry.fallbackContent}</Text>
            ) : (
              <>
                <Text style={styles.subSection}>주제 : {entry.topic}</Text>
                <View style={styles.dashedDivider} />
                <Text style={styles.subLabel}>문제 확인</Text>
                <Text style={styles.subSection}>{entry.diagnosis || ' '}</Text>
                <View style={styles.dashedDivider} />
                <Text style={styles.subLabel}>제안 조언</Text>
                <Text style={styles.subSection}>{entry.advice || ' '}</Text>
                <View style={styles.dashedDivider} />
                <Text style={styles.subLabel}>후속 조치</Text>
                <Text style={styles.subSection}>{entry.followUp || ' '}</Text>
              </>
            )}
          </View>
          <View style={styles.noteCell}>
            <Text>{entry.note || ' '}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default function MonthlyCounselingReport({ header = {}, entries = [] }) {
  return (
    <Document
      title={`컨설팅 보고서 (${header.managerName ?? ''} ${header.periodText ?? ''})`}
      author={header.managerName}
      creator="나매크"
      producer="나매크"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>컨설팅 보고서</Text>
        <HeaderTable header={header} />
        <View>
          <DetailHead />
          {entries.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>해당 기간 상담 기록이 없습니다.</Text>
            </View>
          ) : (
            entries.map((entry) => <EntryBlock key={entry.no} entry={entry} />)
          )}
        </View>
      </Page>
    </Document>
  )
}
