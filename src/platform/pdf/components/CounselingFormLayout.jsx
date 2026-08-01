import { View, Text, Image } from '@react-pdf/renderer'
import { formStyles } from './counselingFormStyles.js'

// 서식 상담 리포트 공용 골격 — MonthlyCounselingReport(강사별)·StudentCounselingReport
// (학생별)·MonthlyLessonReport(수업)가 공유한다.
//
// 2026-08 압축 개편(클라 확정 "페이지 수 최소화"): 칼럼 헤더 없이 각 건이
// [번호][메타 한 줄(음영: 대상 · 일시 · 회차) / 본문 전체 폭] 블록. 내용 라벨은
// 본문과 한 줄 병기(InlineSections), 빈 필드는 생략, 특이사항도 인라인.
//
// 페이지 분할: DetailHead(View fixed, 제목 띠)가 모든 페이지 상단에 반복되고, 각 건
// 블록은 wrap={false}로 건 경계에서만 나뉜다. 테두리는 제목 띠가 4변, 블록이
// 좌/우/하 3변만 가져 페이지 경계에서도 이중선이 없다.
//
// ⚠️ 세로 방향 flex:1 금지 — 높이 auto인 컨테이너에서 높이 0으로 붕괴해 내용이
// 겹쳐 찍힌다(Yoga). 셀 높이는 전부 내용 기반.
// 한계: 상담 1건이 A4 한 장을 넘으면 wrap={false}가 깨져 넘칠 수 있다(실사용상 비발생 전제).


// 제목 행 — NAVI 로고 + 서식 제목. logoSrc는 브라우저에선 기본값(/navi-logo.png),
// node 검증 스크립트에선 파일 경로를 넘긴다.
export function FormTitle({ text, logoSrc = '/navi-logo.png' }) {
  return (
    <View style={formStyles.titleRow}>
      {logoSrc ? <Image src={logoSrc} style={formStyles.titleLogo} /> : null}
      <Text style={formStyles.titleText}>{text}</Text>
    </View>
  )
}

// 상단 헤더 표 — rows: [[{ width, text, label? }, …], …]
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

// 세부내용 표 머리 — fixed로 모든 페이지 상단에 반복. 2026-08 개편으로 칼럼 헤더
// 없이 제목 띠만 남았다(각 건의 메타줄이 스스로를 설명하므로 칼럼명이 불필요).
export function DetailHead() {
  return (
    <View fixed>
      <View style={formStyles.detailTitleBar}>
        <Text style={formStyles.detailTitleText}>세부 내용</Text>
      </View>
    </View>
  )
}

// 내용 섹션 목록 — 빈 필드는 아예 생략하고, 라벨은 본문과 한 줄에 병기(중첩 Text).
// 페이지 수 최소화 개편(2026-08): 라벨 별도 줄·빈 섹션 자리 차지가 페이지를 불리던 주범.
export function InlineSections({ sections }) {
  const filled = sections.filter(([, value]) => value)
  if (filled.length === 0) return <Text> </Text>
  return filled.map(([label, value], i) => (
    <View key={label}>
      {i > 0 && <View style={formStyles.dashedDivider} />}
      <Text style={formStyles.subSection}>
        <Text style={formStyles.subLabel}>{label} : </Text>
        {value}
      </Text>
    </View>
  ))
}

// 메타줄 텍스트 조립 — '김승범 (산청중 2학년) · 7. 5.(토) 14:00~14:20 (20분) · 3회차'
function metaTextOf(leftTop, leftBottom, entry) {
  const subject = leftBottom ? `${leftTop || '-'} (${leftBottom})` : leftTop || '-'
  return [subject, entry.dateTimeText, entry.cumulativeText].filter(Boolean).join('  ·  ')
}

// 상담 건 1개 블록 — wrap={false}로 건 경계 페이지 분할.
// [번호][메타 한 줄(음영) / 본문 전체 폭] 구조. 특이사항도 인라인 섹션(있을 때만).
// entry: { no, dateTimeText, cumulativeText, topic, diagnosis, advice, followUp, fallbackContent, note }
// leftTop/leftBottom: 메타줄 대상 표기 (학생이름·학교학년 또는 상담강사·상담유형)
export function EntryBlock({ entry, leftTop, leftBottom }) {
  return (
    <View style={formStyles.block} wrap={false}>
      <View style={formStyles.colNo}>
        <Text style={formStyles.centerText}>{entry.no}</Text>
      </View>
      <View style={formStyles.colBody}>
        <View style={formStyles.metaRow}>
          <Text style={formStyles.metaText}>{metaTextOf(leftTop, leftBottom, entry)}</Text>
        </View>
        <View style={formStyles.contentCell}>
          {entry.fallbackContent ? (
            <InlineSections sections={[['내용', entry.fallbackContent], ['특이사항', entry.note]]} />
          ) : (
            <InlineSections
              sections={[
                ['주제', entry.topic],
                ['문제 확인', entry.diagnosis],
                ['제안 조언', entry.advice],
                ['후속 조치', entry.followUp],
                ['특이사항', entry.note],
              ]}
            />
          )}
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
