// 재정 기록 → 엑셀 시트 행 빌더 (attendanceExcel.js처럼 DOM/exceljs 무의존 순수함수).
// 반환: { header: string[], rows: (string|number)[][], totalRow: (string|number)[] }

import { FINANCE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '../data/workRecordTypes.js'

export const FINANCE_SHEET_HEADER = [
  '날짜', '구입품목', '물품명', '단가', '갯수', '금액', '구입처', '결제수단', '작성자',
]

export function buildFinanceSheet(records, { educators = [] } = {}) {
  const nameOf = (id) => educators.find((e) => e.id === id)?.name ?? ''
  // 표시는 최신순이지만 엑셀은 날짜 오름차순이 대조에 편하다
  const sorted = [...records].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const rows = sorted.map((r) => [
    r.date,
    FINANCE_CATEGORY_LABELS[r.category] ?? r.category,
    r.itemName,
    r.unitPrice ?? 0,
    r.quantity ?? 0,
    r.amount ?? 0,
    r.vendor,
    PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod,
    nameOf(r.authorId),
  ])

  const total = sorted.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const totalRow = ['합계', '', '', '', '', total, '', '', '']

  return { header: FINANCE_SHEET_HEADER, rows, totalRow }
}
