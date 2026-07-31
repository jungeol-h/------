// 예약현황 엑셀용 순수 시트 빌더 + 다운로드 (centerHoursExcel 관례).
// 상담사별 시트로 나누고 맨 앞에 '전체' 시트를 둔다. 학생·학부모 연락처는
// users.phone / parent_phone에 저장된 전화번호를 표시한다 (formatPhone 관례).

import { formatPhone } from '../utils/formatPhone.js'
import { reservationDisplayStatus } from './bookingStatus.js'

const COLUMNS = ['날짜', '시간', '프로그램', '교과', '상담사', '학생', '학생 연락처', '학부모 연락처', '상태']

// 엑셀 시트명 금지문자 제거 + 31자 제한
function safeSheetName(name) {
  const cleaned = String(name || '미지정').replace(/[\\/*?:[\]]/g, ' ').trim() || '미지정'
  return cleaned.slice(0, 31)
}

// reservations: slot 조인 포함(booking) — slot 없는 건 제외(호출부 필터와 동일 기준)
// 반환: [{ name, rows: [[...COLUMNS 순서 값]] }] — 전체 시트 + 상담사별 시트
// splitByEducator=false면 '전체' 시트 1장만 반환 (강사 본인 슬롯처럼 이미 단일 강사로
// 좁혀진 경우 상담사별 분할이 불필요 — 2026-07-31 강사 '내 슬롯' 엑셀 다운로드)
export function buildReservationSheets({ reservations = [], students = [], userNames = {}, config, splitByEducator = true }) {
  const studentById = new Map(students.map((s) => [s.id, s]))
  const programName = (id) => config?.programs?.find((p) => p.id === id)?.name ?? ''
  const subjectName = (id) => config?.subjects?.find((s) => s.id === id)?.name ?? ''
  const educatorName = (id) => (id ? userNames[id]?.name ?? id : '미지정')

  const toRow = (r) => {
    const student = studentById.get(r.studentId)
    return [
      r.slot.date,
      `${r.slot.startTime}~${r.slot.endTime}`,
      programName(r.programId),
      r.slot.subjectId ? subjectName(r.slot.subjectId) : '',
      educatorName(r.slot.educatorId),
      student?.name ?? userNames[r.studentId]?.name ?? r.studentId,
      formatPhone(student?.phone),
      formatPhone(student?.parentPhone),
      reservationDisplayStatus(r, r.slot).label,
    ]
  }

  const valid = reservations
    .filter((r) => r.slot)
    .slice()
    .sort((a, b) => (a.slot.date === b.slot.date
      ? (a.slot.startTime < b.slot.startTime ? -1 : 1)
      : a.slot.date < b.slot.date ? -1 : 1))

  if (!splitByEducator) return [{ name: '전체', rows: valid.map(toRow) }]

  // 상담사별 그룹 (시트 순서: 이름 가나다순, 미지정은 마지막)
  const byEducator = new Map()
  for (const r of valid) {
    const key = r.slot.educatorId ?? ''
    if (!byEducator.has(key)) byEducator.set(key, [])
    byEducator.get(key).push(r)
  }
  const educatorSheets = [...byEducator.entries()]
    .map(([id, list]) => ({ name: educatorName(id), rows: list.map(toRow), unassigned: !id }))
    .sort((a, b) => (a.unassigned !== b.unassigned
      ? (a.unassigned ? 1 : -1)
      : a.name.localeCompare(b.name, 'ko')))
    .map(({ name, rows }) => ({ name, rows }))

  return [{ name: '전체', rows: valid.map(toRow) }, ...educatorSheets]
}

// exceljs는 동적 import — 초기 번들 보호 (centerHoursExcel 관례)
export async function downloadReservationWorkbook(sheets, fileLabel) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }

  const used = new Set()
  for (const sheet of sheets) {
    let name = safeSheetName(sheet.name)
    let n = 2
    while (used.has(name)) name = safeSheetName(`${sheet.name} (${n++})`)
    used.add(name)

    const ws = workbook.addWorksheet(name)
    const headerRow = ws.addRow(COLUMNS)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = HEADER_FILL
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    for (const row of sheet.rows) ws.addRow(row)

    const widths = [12, 13, 16, 8, 12, 12, 15, 15, 10]
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `예약현황_${fileLabel}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
