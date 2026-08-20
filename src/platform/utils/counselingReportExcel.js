// 컨설팅 보고서(pdf/reports/MonthlyCounselingReport) 엑셀(A4) 출력 — 순수 로직 없음,
// exceljs 동적 import 다운로드 함수 하나. reservationExcel.js 관례를 따른다.
// PDF 서식(FormHeaderTable + CounselingFormLayout의 EntryBlock)을 시트로 재현한다.

const COL_COUNT = 6
// A4 세로 인쇄에 맞는 비율(총 100 기준, fitToWidth가 실제 폭은 맞춰준다).
// [번호 | 라벨 | 값 | 라벨 | 값 | 값(우측 보조)] — 헤더 표의 6칸 구조와 본문 표를 겸용.
const COLUMN_WIDTHS = [6, 14, 26, 14, 26, 20]

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
const META_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
const THIN = { style: 'thin', color: { argb: 'FF9CA3AF' } }
const ALL_BORDERS = { top: THIN, left: THIN, bottom: THIN, right: THIN }

// 병합 셀은 엑셀이 행높이를 자동조정하지 못하므로, 텍스트 길이/열폭으로 줄 수를 추정해
// row.height를 직접 계산한다. charsPerLine은 병합된 셀의 대략적인 표시 가능 글자 수.
function estimateRowHeight(text, charsPerLine) {
  const str = String(text ?? '')
  if (!str) return 18
  const lines = str.split('\n')
  let wrapped = 0
  for (const line of lines) wrapped += Math.max(1, Math.ceil(line.length / charsPerLine))
  return wrapped * 14 + 6
}

function setBorders(cell) {
  cell.border = ALL_BORDERS
}

function labelCell(cell, text) {
  cell.value = text
  cell.font = { bold: true }
  cell.fill = META_FILL
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  setBorders(cell)
}

function valueCell(cell, text, { wrap = false } = {}) {
  cell.value = text
  cell.alignment = { horizontal: wrap ? 'left' : 'center', vertical: wrap ? 'top' : 'middle', wrapText: wrap }
  setBorders(cell)
}

// entry의 내용 섹션 — CounselingFormLayout.InlineSections와 동일한 필드 우선순위.
function contentLines(entry) {
  if (entry.fallbackContent) {
    return [['내용', entry.fallbackContent], ['특이사항', entry.note]].filter(([, v]) => v)
  }
  return [
    ['주제', entry.topic],
    ['문제 확인', entry.diagnosis],
    ['제안 조언', entry.advice],
    ['후속 조치', entry.followUp],
    ['특이사항', entry.note],
  ].filter(([, v]) => v)
}

function metaText(entry) {
  const subject = entry.schoolGrade ? `${entry.studentName || '-'} (${entry.schoolGrade})` : entry.studentName || '-'
  return [subject, entry.dateTimeText, entry.cumulativeText].filter(Boolean).join('  ·  ')
}

// header: { managerName, periodText, duty, schedule, totalUnits, totalMinutes }
// entries: buildMonthlyCounselingEntries 산출물 배열
export async function downloadCounselingReportExcel({ header = {}, entries = [], filename }) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('컨설팅 보고서')

  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  }

  COLUMN_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  // ① 제목
  const titleRow = ws.addRow(['컨설팅 보고서'])
  ws.mergeCells(titleRow.number, 1, titleRow.number, COL_COUNT)
  titleRow.height = 28
  titleRow.getCell(1).font = { bold: true, size: 16 }
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

  // ② 헤더 표 2행 = MonthlyCounselingReport 6칸 구조
  //   1행: 담당자 | managerName | 작성기간 | periodText | 시수 | {totalUnits}T
  //   2행: 담당업무 | duty | 업무일정 | schedule | 총시간 | {totalMinutes}분
  const headerRow1 = ws.addRow(['담당자', header.managerName ?? '', '작성기간', header.periodText ?? '', '시수', `${header.totalUnits ?? 0}T`])
  labelCell(headerRow1.getCell(1), '담당자')
  valueCell(headerRow1.getCell(2), header.managerName ?? '')
  labelCell(headerRow1.getCell(3), '작성기간')
  valueCell(headerRow1.getCell(4), header.periodText ?? '')
  labelCell(headerRow1.getCell(5), '시수')
  valueCell(headerRow1.getCell(6), `${header.totalUnits ?? 0}T`)

  const headerRow2 = ws.addRow(['담당업무', header.duty ?? '', '업무일정', header.schedule ?? '', '총시간', `${(header.totalMinutes ?? 0).toLocaleString('ko-KR')}분`])
  labelCell(headerRow2.getCell(1), '담당업무')
  valueCell(headerRow2.getCell(2), header.duty ?? '')
  labelCell(headerRow2.getCell(3), '업무일정')
  valueCell(headerRow2.getCell(4), header.schedule ?? '')
  labelCell(headerRow2.getCell(5), '총시간')
  valueCell(headerRow2.getCell(6), `${(header.totalMinutes ?? 0).toLocaleString('ko-KR')}분`)

  // ③ '세부 내용' 밴드
  const bandRow = ws.addRow(['세부 내용'])
  ws.mergeCells(bandRow.number, 1, bandRow.number, COL_COUNT)
  bandRow.getCell(1).font = { bold: true }
  bandRow.getCell(1).fill = HEADER_FILL
  bandRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  bandRow.eachCell((cell) => setBorders(cell))
  bandRow.height = 20

  // ④ entries 반복
  if (entries.length === 0) {
    const emptyRow = ws.addRow(['해당 기간 상담 기록이 없습니다.'])
    ws.mergeCells(emptyRow.number, 1, emptyRow.number, COL_COUNT)
    emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    emptyRow.getCell(1).font = { color: { argb: 'FF6B7280' } }
    emptyRow.height = 24
    emptyRow.eachCell((cell) => setBorders(cell))
  } else {
    // 병합 셀의 대략적 표시 가능 글자 수 — 열폭(문자 단위) 합에서 여유를 뺀 근사치.
    const metaCharsPerLine = COLUMN_WIDTHS.slice(1).reduce((a, b) => a + b, 0) - 4
    const contentCharsPerLine = COLUMN_WIDTHS.slice(2).reduce((a, b) => a + b, 0) - 4

    for (const entry of entries) {
      // 메타 행: {no} | {studentName (schoolGrade)} · {dateTimeText} · {cumulativeText} (병합, 굵게+옅은 fill)
      const meta = metaText(entry)
      const metaRow = ws.addRow([entry.no])
      ws.mergeCells(metaRow.number, 2, metaRow.number, COL_COUNT)
      metaRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      metaRow.getCell(1).font = { bold: true }
      const metaValueCell = metaRow.getCell(2)
      metaValueCell.value = meta
      metaValueCell.font = { bold: true }
      metaValueCell.fill = META_FILL
      metaValueCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      metaRow.eachCell((cell) => setBorders(cell))
      metaRow.height = estimateRowHeight(meta, metaCharsPerLine)

      // 내용 행들 — 라벨 셀 + 내용 병합 셀. 빈 값 행은 생략.
      const lines = contentLines(entry)
      for (const [label, value] of lines) {
        const row = ws.addRow([])
        row.getCell(1).value = ''
        setBorders(row.getCell(1))
        labelCell(row.getCell(2), label)
        const valCell = row.getCell(3)
        ws.mergeCells(row.number, 3, row.number, COL_COUNT)
        valCell.value = value
        valCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }
        setBorders(valCell)
        row.height = estimateRowHeight(value, contentCharsPerLine)
      }
    }
  }

  ws.views = [{ state: 'frozen', ySplit: 5 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
