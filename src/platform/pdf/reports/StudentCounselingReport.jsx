import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formStyles } from '../components/counselingFormStyles.js'
import {
  FormHeaderTable, DetailHead, EntryBlock, EmptyDetailBox,
} from '../components/CounselingFormLayout.jsx'

// 학생별 컨설팅 리포트 — docs/학생별 상담이력 리포트.pdf 재현 (관공서 제출용 서식).
// 재원생/외생(외부 학생) 공용. DataContext에 의존하지 않고 순수 props만 받는다.
// 서식 골격·페이지 분할 규칙은 components/CounselingFormLayout.jsx 주석 참조.
// props:
//   header: { studentName, schoolGrade, periodText, scheduleText, totalCount }
//     scheduleText: 자동 출결 등록 시간블록 기호 (selectors/studentCounselingReport.js
//                   formatScheduleBlocks 산출물, 예: 'M1 M3 · T2 · SA1'). 외생은 빈칸.
//   entries: [{ no, educatorName, typeLabel, dateTimeText, cumulativeText,
//               topic, diagnosis, advice, followUp, fallbackContent, note }]
//             — buildStudentCounselingEntries 산출물.

export default function StudentCounselingReport({ header = {}, entries = [] }) {
  const headerRows = [
    [
      { width: '10%', text: '학생이름', label: true },
      { width: '30%', text: header.studentName },
      { width: '10%', text: '조회기간', label: true },
      { width: '50%', text: header.periodText },
    ],
    [
      { width: '10%', text: '학교학년', label: true },
      { width: '30%', text: header.schoolGrade },
      { width: '10%', text: '등록일정', label: true },
      { width: '30%', text: header.scheduleText },
      { width: '8%', text: '시수', label: true },
      { width: '12%', text: `총 ${header.totalCount}회` },
    ],
  ]

  return (
    <Document
      title={`학생별 컨설팅 리포트 (${header.studentName ?? ''})`}
      author={header.studentName}
      creator="나매크"
      producer="나매크"
    >
      <Page size="A4" style={formStyles.page}>
        <Text style={formStyles.title}>학생별 컨설팅 리포트</Text>
        <FormHeaderTable rows={headerRows} />
        <View>
          <DetailHead leftTopLabel="상담강사" leftBottomLabel="상담유형" />
          {entries.length === 0 ? (
            <EmptyDetailBox />
          ) : (
            entries.map((entry) => (
              <EntryBlock
                key={entry.no}
                entry={entry}
                leftTop={entry.educatorName}
                leftBottom={entry.typeLabel}
              />
            ))
          )}
        </View>
      </Page>
    </Document>
  )
}
