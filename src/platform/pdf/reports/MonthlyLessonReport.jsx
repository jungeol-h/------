import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formStyles } from '../components/counselingFormStyles.js'
import {
  FormTitle, FormHeaderTable, DetailHead, EmptyDetailBox,
} from '../components/CounselingFormLayout.jsx'

// 강사별 월간 수업보고서 — MonthlyCounselingReport와 같은 관공서 서식 골격에
// 수업보고 필드(참여학생 복수·교재·과제)만 다르다. DataContext 의존 금지, 순수 props.
// 페이지번호 render 콜백 금지·세로 flex:1 금지 (pdf/README.md · CounselingFormLayout 주석).
// props:
//   header: { managerName, periodText, duty, schedule, totalCount }
//   entries: [{ no, studentNames, studentCountText, dateTimeText, cumulativeText,
//               topic, textbook, content, homework, note }]
//             — selectors/monthlyLessonReport.js buildMonthlyLessonEntries 산출물.

// 수업 건 1개 블록 — EntryBlock의 수업보고 변형 (교재·수업내용·과제 구성).
function LessonEntryBlock({ entry }) {
  return (
    <View style={formStyles.block} wrap={false}>
      <View style={formStyles.colNo}>
        <Text style={formStyles.centerText}>{entry.no}</Text>
      </View>
      <View style={formStyles.colBody}>
        <View style={formStyles.rowTop}>
          <View style={formStyles.leftTopCell}>
            <Text style={formStyles.centerText}>{entry.studentNames || ' '}</Text>
          </View>
          <View style={formStyles.dateTimeCell}>
            <Text style={formStyles.centerText}>{entry.dateTimeText}</Text>
          </View>
          <View style={formStyles.roundCell}>
            <Text style={formStyles.centerText}>{entry.cumulativeText}</Text>
          </View>
        </View>
        <View style={formStyles.rowBody}>
          <View style={formStyles.leftBottomCell}>
            <Text style={formStyles.centerText}>{entry.studentCountText || ' '}</Text>
          </View>
          <View style={formStyles.contentCell}>
            <Text style={formStyles.subSection}>주제 : {entry.topic}</Text>
            <View style={formStyles.dashedDivider} />
            <Text style={formStyles.subLabel}>수업 교재</Text>
            <Text style={formStyles.subSection}>{entry.textbook || ' '}</Text>
            <View style={formStyles.dashedDivider} />
            <Text style={formStyles.subLabel}>수업 내용</Text>
            <Text style={formStyles.subSection}>{entry.content || ' '}</Text>
            <View style={formStyles.dashedDivider} />
            <Text style={formStyles.subLabel}>과제</Text>
            <Text style={formStyles.subSection}>{entry.homework || ' '}</Text>
          </View>
          <View style={formStyles.noteCell}>
            <Text>{entry.note || ' '}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default function MonthlyLessonReport({ header = {}, entries = [], logoSrc }) {
  const headerRows = [
    [
      { width: '10%', text: '담당자', label: true },
      { width: '30%', text: header.managerName },
      { width: '10%', text: '작성기간', label: true },
      { width: '50%', text: header.periodText },
    ],
    [
      { width: '10%', text: '담당업무', label: true },
      { width: '30%', text: header.duty },
      { width: '10%', text: '업무일정', label: true },
      { width: '30%', text: header.schedule },
      { width: '8%', text: '시수', label: true },
      { width: '12%', text: `총 ${header.totalCount}회` },
    ],
  ]

  return (
    <Document
      title={`수업 보고서 (${header.managerName ?? ''} ${header.periodText ?? ''})`}
      author={header.managerName}
      creator="나매크"
      producer="나매크"
    >
      <Page size="A4" style={formStyles.page}>
        <FormTitle text="수업 보고서" {...(logoSrc !== undefined && { logoSrc })} />
        <FormHeaderTable rows={headerRows} />
        <View>
          <DetailHead
            leftTopLabel="참여학생"
            leftBottomLabel="인원"
            dateTimeLabel="수업일시(수업시간)"
            contentLabel="수업내용"
          />
          {entries.length === 0 ? (
            <EmptyDetailBox text="해당 기간 수업보고 기록이 없습니다." />
          ) : (
            entries.map((entry) => <LessonEntryBlock key={entry.no} entry={entry} />)
          )}
        </View>
      </Page>
    </Document>
  )
}
