// 센터 이용시간 출석부 엑셀용 순수 시트 빌더 — DOM/exceljs 의존 없음.
// 클라이언트가 쓰던 수기 출석부 포맷을 따른다:
// 요일별 시트 > 시간 단위 열(학생 이름 | 학교·학년 2열) > 학년→이름순 행.

import {
  CENTER_HOUR_UNITS, DEFAULT_OPERATING_DAYS, operatingDayOrder, unitKey, unitLabel,
} from '../data/centerHours.js'

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

// 학년(중1→중3) 우선, 같은 학년은 이름 가나다순
function compareStudents(a, b) {
  const byGrade = (a.grade ?? '').localeCompare(b.grade ?? '', 'ko')
  if (byGrade !== 0) return byGrade
  return (a.name ?? '').localeCompare(b.name ?? '', 'ko')
}

// registrations: [{ studentId, dayOfWeek, startTime }]
// students: [{ id, name, school, grade }]
// 반환: [{ name:'월요일', units:[{ label, count, entries:[{ name, meta }] }] }]
export function buildCenterHoursSheets({
  registrations = [],
  students = [],
  unitsByDay = CENTER_HOUR_UNITS,
  dayOrder = operatingDayOrder(DEFAULT_OPERATING_DAYS),
}) {
  const studentById = new Map(students.map((s) => [s.id, s]))

  // (day#start) → student[]
  const bucket = new Map()
  for (const reg of registrations) {
    const student = studentById.get(reg.studentId)
    if (!student) continue // 탈퇴 등으로 명단에 없는 학생은 제외
    const k = unitKey(reg.dayOfWeek, reg.startTime)
    if (!bucket.has(k)) bucket.set(k, [])
    bucket.get(k).push(student)
  }

  return dayOrder.map((day) => ({
    name: DAY_NAMES[day],
    units: (unitsByDay[day] ?? []).map((u) => {
      const entries = (bucket.get(unitKey(day, u.start)) ?? [])
        .slice()
        .sort(compareStudents)
        .map((s) => ({
          name: s.name,
          meta: [s.school, s.grade].filter(Boolean).join(' '),
        }))
      return { label: unitLabel(u), count: entries.length, entries }
    }),
  }))
}

// 시트 데이터를 exceljs 워크북으로 렌더링하고 다운로드 트리거.
// exceljs는 동적 import — 초기 번들 보호 (AttendanceExcelModal 관례).
export async function downloadCenterHoursWorkbook(sheets, fileLabel) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()

  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
  const SUB_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
  const center = { horizontal: 'center', vertical: 'middle' }

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name)
    const units = sheet.units

    // 1행: 시간 단위 라벨(+인원), 2행: 학생 이름 | 학교·학년.
    // 병합은 두 행을 모두 추가한 뒤에 한다 — 병합된 슬레이브 셀에 addRow로
    // 쓰면 마스터 값이 오염될 수 있다.
    const headerRow = ws.addRow([
      '번호',
      ...units.flatMap((u) => [`${u.label} (${u.count}명)`, '']),
    ])
    const subRow = ws.addRow(['', ...units.flatMap(() => ['학생 이름', '학교·학년'])])
    units.forEach((_, i) => {
      ws.mergeCells(1, 2 + i * 2, 1, 3 + i * 2) // 단위 라벨 가로 2열 병합
    })
    ws.mergeCells(1, 1, 2, 1) // 번호 칸은 1~2행 세로 병합
    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = HEADER_FILL
      cell.alignment = center
    })
    subRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = SUB_FILL
      cell.alignment = center
    })

    // 데이터 행: 단위별 명단을 나란히
    const maxLen = Math.max(0, ...units.map((u) => u.entries.length))
    for (let i = 0; i < maxLen; i++) {
      const row = ws.addRow([
        i + 1,
        ...units.flatMap((u) => {
          const e = u.entries[i]
          return e ? [e.name, e.meta] : ['', '']
        }),
      ])
      row.getCell(1).alignment = center
    }

    ws.getColumn(1).width = 6
    for (let i = 0; i < units.length * 2; i++) {
      ws.getColumn(2 + i).width = i % 2 === 0 ? 12 : 16
    }
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }]
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `센터_시간대별_출석부_${fileLabel}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
