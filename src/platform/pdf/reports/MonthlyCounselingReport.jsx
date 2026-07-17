import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formStyles } from '../components/counselingFormStyles.js'
import {
  FormHeaderTable, DetailHead, EntryBlock, EmptyDetailBox,
} from '../components/CounselingFormLayout.jsx'

// 강사별 월간 컨설팅 보고서 — docs/보고서 양식.pdf 재현 (관공서 제출용 서식).
// 재원생/외부 상담 공용. DataContext에 의존하지 않고 순수 props만 받는다.
// 서식 골격·페이지 분할 규칙은 components/CounselingFormLayout.jsx 주석 참조.
// 양식 서식이라 브랜드 헤더(PageWrapper)는 쓰지 않는다. 페이지번호 render 콜백 금지(pdf/README.md).
// props:
//   header: { managerName, periodText, duty, schedule, totalCount }
//   entries: [{ no, studentName, schoolGrade, dateTimeText, cumulativeText,
//               topic, diagnosis, advice, followUp, fallbackContent, note }]
//             — selectors/monthlyCounselingReport.js buildMonthlyCounselingEntries 산출물.

export default function MonthlyCounselingReport({ header = {}, entries = [] }) {
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
      title={`컨설팅 보고서 (${header.managerName ?? ''} ${header.periodText ?? ''})`}
      author={header.managerName}
      creator="나매크"
      producer="나매크"
    >
      <Page size="A4" style={formStyles.page}>
        <Text style={formStyles.title}>컨설팅 보고서</Text>
        <FormHeaderTable rows={headerRows} />
        <View>
          <DetailHead leftTopLabel="학생이름" leftBottomLabel="학교학년" />
          {entries.length === 0 ? (
            <EmptyDetailBox text="해당 기간 상담 기록이 없습니다." />
          ) : (
            entries.map((entry) => (
              <EntryBlock
                key={entry.no}
                entry={entry}
                leftTop={entry.studentName}
                leftBottom={entry.schoolGrade}
              />
            ))
          )}
        </View>
      </Page>
    </Document>
  )
}
