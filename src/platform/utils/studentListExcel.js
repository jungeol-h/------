// 학생 목록 보고서 엑셀 — 순수 행 빌더 + exceljs 동적 import 다운로드 (reservationExcel.js 관례).
// PDF(pdf/reports/UserListReport.jsx)와 같은 화면 필터·정렬 결과를 그대로 받는다.
// 엑셀에서는 퇴원일·신청취소일을 각각 별도 열로 둔다 — 필터·정렬로 처리 일자별 집계가 쉽게
// (2026-10-01 클라이언트: 퇴원·신청취소 처리 일자가 표시되는 엑셀 양식 요청).

import { STUDENT_STATUS_LABELS } from '../data/studentStatus.js'
import { formatPhone } from './formatPhone.js'

export const STUDENT_LIST_COLUMNS = [
  '순번', '이름', '성별', '소속 그룹', '학교', '학년', '반', '학생 연락처', '학부모 연락처', '담당 매니저',
  '위험도', '자기주도지수', '상태', '입학일', '퇴원일', '신청취소일',
]
const COLUMN_WIDTHS = [6, 10, 6, 14, 16, 6, 6, 15, 15, 12, 8, 12, 9, 12, 12, 12]

const RISK_LABELS = { normal: '정상', warning: '주의', danger: '위험' }
const GENDER_LABELS = { M: '남', F: '여' }

// 퇴원·취소일은 현재 상태와 일치하는 날짜만 표시 — 재원 복구 후에도 남아있는 옛 날짜
// (setStudentStatus 정책상 지우지 않음)가 재원생에게 뜨는 걸 막는다 (UserListReport와 동일 규칙).
// 구 상태 'inactive'는 퇴원 계열로 본다. 처리일 자동 기록(2026-09-30) 이전에 처리돼
// 날짜가 없는 학생은 '미기록' — 빈칸이면 출력 오류로 오해된다(2026-10-03 클라이언트).
// 학생 수정 모달에서 수기 입력하면 채워진다.
export const DATE_UNRECORDED = '미기록'
export function statusDatesOf(s) {
  const status = s.status ?? 'active'
  return {
    withdrawnAt: status === 'withdrawn' || status === 'inactive' ? (s.withdrawnAt || DATE_UNRECORDED) : '',
    cancelledAt: status === 'cancelled' ? (s.cancelledAt || DATE_UNRECORDED) : '',
  }
}

// students: 화면에 보이는 순서 그대로 / managerNameOf: studentId → 매니저 이름
// 반환: [[...STUDENT_LIST_COLUMNS 순서 값]] — 날짜는 'YYYY-MM-DD' 문자열 그대로
export function buildStudentListRows(students = [], managerNameOf = () => '') {
  return students.map((s, idx) => {
    const { withdrawnAt, cancelledAt } = statusDatesOf(s)
    return [
      idx + 1,
      s.name || '',
      GENDER_LABELS[s.gender] ?? '',
      (s.groups ?? []).join(', ') || '무소속',
      s.school || '',
      s.grade || '',
      s.className || '',
      formatPhone(s.phone),
      formatPhone(s.parentPhone),
      managerNameOf(s.id) || '미배정',
      RISK_LABELS[s.riskLevel] ?? RISK_LABELS.normal,
      s.selfIndex ?? '',
      STUDENT_STATUS_LABELS[s.status ?? 'active'] ?? s.status,
      s.enrolledAt || '',
      withdrawnAt,
      cancelledAt,
    ]
  })
}

// conditions: [[라벨, 값]] — '조회 조건' 시트에 그대로 적는다 (PDF 조회 조건 섹션 대응)
export async function downloadStudentListWorkbook({ rows, conditions = [], sheetName = '학생 목록', filename }) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }

  const ws = workbook.addWorksheet(String(sheetName).replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || '학생 목록')
  const headerRow = ws.addRow(STUDENT_LIST_COLUMNS)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.fill = HEADER_FILL
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  for (const row of rows) ws.addRow(row)
  COLUMN_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: STUDENT_LIST_COLUMNS.length } }

  if (conditions.length > 0) {
    const cs = workbook.addWorksheet('조회 조건')
    for (const [label, value] of conditions) {
      const r = cs.addRow([label, value])
      r.getCell(1).font = { bold: true }
    }
    cs.getColumn(1).width = 14
    cs.getColumn(2).width = 40
  }

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
