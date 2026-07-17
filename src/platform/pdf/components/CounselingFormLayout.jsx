import { View, Text } from '@react-pdf/renderer'
import { formStyles } from './counselingFormStyles.js'

// 관공서 서식 상담 리포트 공용 골격 — docs/보고서 양식.pdf 계열.
// MonthlyCounselingReport(강사별 월간)·StudentCounselingReport(학생별)가 공유한다.
//
// 페이지 분할: DetailHead(View fixed)가 모든 페이지 상단에 반복되고, 각 상담 건
// 블록은 wrap={false}로 건 경계에서만 나뉜다 (components/Table.jsx의 검증된 패턴).
// 테두리는 머리가 4변, 블록이 좌/우/하 3변만 가져 페이지 경계에서도 이중선이 없다.
//
// ⚠️ 세로 방향 flex:1 금지 — 높이 auto인 컨테이너에서 높이 0으로 붕괴해 내용이
// 겹쳐 찍힌다(Yoga). 셀 높이는 전부 내용 기반, 열은 row stretch로 맞춘다.
// 한계: 상담 1건이 A4 한 장을 넘으면 wrap={false}가 깨져 넘칠 수 있다(실사용상 비발생 전제).


// 상단 헤더 표 — rows: [[{ width, text, label?, last? }, …], …]
export function FormHeaderTable({ rows }) {
  return (
    <View style={formStyles.headerTable}>
      {rows.map((cells, rIdx) => (
        <View
          key={rIdx}
          style={[formStyles.headerRow, rIdx === rows.length - 1 && formStyles.headerRowLast].filter(Boolean)}
        >
          {cells.map((cell, cIdx) => (
            <View
              key={cIdx}
              style={[
                formStyles.headerCell,
                { width: cell.width },
                cell.label && formStyles.headerLabel,
                cIdx === cells.length - 1 && formStyles.headerCellLast,
              ].filter(Boolean)}
            >
              <Text style={formStyles.headerText}>{cell.text}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

// 세부내용 표 머리 — fixed로 모든 페이지 상단에 반복.
// leftTopLabel/leftBottomLabel: 좌측 열 라벨 (학생이름/학교학년 또는 상담강사/상담유형)
export function DetailHead({ leftTopLabel, leftBottomLabel }) {
  return (
    <View fixed>
      <View style={formStyles.detailTitleBar}>
        <Text style={formStyles.detailTitleText}>세부 내용</Text>
      </View>
      <View style={[formStyles.block, formStyles.blockHead]}>
        <View style={formStyles.colNo}>
          <Text style={formStyles.centerText}>번호</Text>
        </View>
        <View style={formStyles.colLeft}>
          <View style={formStyles.stackTop}>
            <Text style={formStyles.centerText}>{leftTopLabel}</Text>
          </View>
          <View style={formStyles.stackBottom}>
            <Text style={formStyles.centerText}>{leftBottomLabel}</Text>
          </View>
        </View>
        <View style={formStyles.colMain}>
          <View style={formStyles.rowTop}>
            <View style={formStyles.dateTimeCell}>
              <Text style={formStyles.centerText}>상담일시(상담시간)</Text>
            </View>
            <View style={formStyles.roundCell}>
              <Text style={formStyles.centerText}>누적횟수</Text>
            </View>
          </View>
          <View style={formStyles.rowBody}>
            <View style={[formStyles.contentCell, { justifyContent: 'center' }]}>
              <Text style={formStyles.centerText}>상담내용</Text>
            </View>
            <View style={[formStyles.noteCell, { justifyContent: 'center' }]}>
              <Text style={formStyles.centerText}>특이사항</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

// 상담 건 1개 블록 — wrap={false}로 건 경계 페이지 분할.
// entry: { no, dateTimeText, cumulativeText, topic, diagnosis, advice, followUp, fallbackContent, note }
// leftTop/leftBottom: 좌측 열 값 (학생이름/학교학년 또는 상담강사/상담유형)
export function EntryBlock({ entry, leftTop, leftBottom }) {
  return (
    <View style={formStyles.block} wrap={false}>
      <View style={formStyles.colNo}>
        <Text style={formStyles.centerText}>{entry.no}</Text>
      </View>
      <View style={formStyles.colLeft}>
        <View style={formStyles.stackTop}>
          <Text style={formStyles.centerText}>{leftTop || ' '}</Text>
        </View>
        <View style={formStyles.stackBottom}>
          <Text style={formStyles.centerText}>{leftBottom || ' '}</Text>
        </View>
      </View>
      <View style={formStyles.colMain}>
        <View style={formStyles.rowTop}>
          <View style={formStyles.dateTimeCell}>
            <Text style={formStyles.centerText}>{entry.dateTimeText}</Text>
          </View>
          <View style={formStyles.roundCell}>
            <Text style={formStyles.centerText}>{entry.cumulativeText}</Text>
          </View>
        </View>
        <View style={formStyles.rowBody}>
          <View style={formStyles.contentCell}>
            {entry.fallbackContent ? (
              <Text>{entry.fallbackContent}</Text>
            ) : (
              <>
                <Text style={formStyles.subSection}>주제 : {entry.topic}</Text>
                <View style={formStyles.dashedDivider} />
                <Text style={formStyles.subLabel}>문제 확인</Text>
                <Text style={formStyles.subSection}>{entry.diagnosis || ' '}</Text>
                <View style={formStyles.dashedDivider} />
                <Text style={formStyles.subLabel}>제안 조언</Text>
                <Text style={formStyles.subSection}>{entry.advice || ' '}</Text>
                <View style={formStyles.dashedDivider} />
                <Text style={formStyles.subLabel}>후속 조치</Text>
                <Text style={formStyles.subSection}>{entry.followUp || ' '}</Text>
              </>
            )}
          </View>
          <View style={formStyles.noteCell}>
            <Text>{entry.note || ' '}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

// 기록 없음 표시 (머리 아래에 붙는 블록)
export function EmptyDetailBox({ text = '상담 기록이 없습니다.' }) {
  return (
    <View style={formStyles.emptyBox}>
      <Text style={formStyles.emptyText}>{text}</Text>
    </View>
  )
}
