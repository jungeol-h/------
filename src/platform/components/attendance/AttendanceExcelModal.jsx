// 출결 엑셀 추출 모달 — 관리자/매니저 공용.
// 자체적으로 supabase에서 해당 월 attendance_records + 학생(users)을 조회한다.
// (매니저 컨텍스트 fetch는 60일 제한이라 컨텍스트 data 대신 직접 조회)
// 월별 파일 > 주별 시트 > 시간대 행 × 날짜 열 구조의 .xlsx를 다운로드한다.

import { useState } from 'react'
import { X, FileSpreadsheet, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { buildAttendanceGrid } from '../../utils/attendanceExcel.js'

const SLOT_OPTIONS = [
  { value: 30, label: '30분 단위' },
  { value: 60, label: '1시간 단위' },
  { value: 120, label: '2시간 단위' },
]

// 06:00~24:00 30분 간격 시각 옵션
const TIME_OPTIONS = (() => {
  const out = []
  for (let m = 360; m <= 1440; m += 30) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    out.push({ value: m, label: `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}` })
  }
  return out
})()

function currentMonthValue() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

const fieldClass =
  'w-full border border-gray-200 rounded-xl p-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300'

export default function AttendanceExcelModal({ open, onClose }) {
  const [monthValue, setMonthValue] = useState(currentMonthValue)
  const [slotMinutes, setSlotMinutes] = useState(60)
  const [startMinutes, setStartMinutes] = useState(540) // 09:00
  const [endMinutes, setEndMinutes] = useState(1320) // 22:00
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (!open) return null

  const [year, month] = monthValue.split('-').map(Number)
  const rangeValid = startMinutes < endMinutes

  const handleGenerate = async () => {
    setError('')
    setInfo('')
    if (!year || !month) {
      setError('월을 선택해주세요.')
      return
    }
    if (!rangeValid) {
      setError('시작 시간이 끝 시간보다 빨라야 합니다.')
      return
    }
    setLoading(true)
    try {
      const firstDate = `${year}-${String(month).padStart(2, '0')}-01`
      const lastDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`

      const [attRes, userRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('id, student_id, date, status, check_in_at, check_out_at, checkout_status')
          .gte('date', firstDate)
          .lte('date', lastDate),
        supabase
          .from('users')
          .select('id, name, school, grade')
          .eq('role', 'student')
          .eq('status', 'active'),
      ])

      if (attRes.error) throw attRes.error
      if (userRes.error) throw userRes.error

      const records = (attRes.data ?? []).map((r) => ({
        studentId: r.student_id,
        date: r.date,
        status: r.status,
        checkInAt: r.check_in_at ?? null,
        checkoutStatus: r.checkout_status ?? null,
      }))
      const students = (userRes.data ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        school: u.school,
        grade: u.grade,
      }))

      const hasCheckIn = records.some((r) => r.checkInAt)
      if (!hasCheckIn) {
        setInfo('해당 월 출결 기록이 없습니다.')
        setLoading(false)
        return
      }

      const { weeks } = buildAttendanceGrid({
        records,
        students,
        year,
        month,
        slotMinutes,
        startMinutes,
        endMinutes,
      })

      await generateWorkbook({ weeks, year, month })
      setInfo('엑셀 파일을 다운로드했습니다.')
    } catch (e) {
      // 콘솔 크래시 금지 — 모달 내 메시지로만 표면화
      console.warn('[AttendanceExcelModal] 생성 실패', e)
      setError('출결 데이터를 불러오거나 파일을 만드는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4 sm:items-center">
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-500" />
            출결 엑셀 추출
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">대상 월</label>
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">시간대 단위</label>
          <select
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            className={fieldClass}
          >
            {SLOT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">시작 시간</label>
            <select
              value={startMinutes}
              onChange={(e) => setStartMinutes(Number(e.target.value))}
              className={fieldClass}
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">끝 시간</label>
            <select
              value={endMinutes}
              onChange={(e) => setEndMinutes(Number(e.target.value))}
              className={fieldClass}
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {!rangeValid && (
          <p className="text-xs text-red-500">시작 시간이 끝 시간보다 빨라야 합니다.</p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        {info && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-xl p-3">{info}</p>}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium"
          >
            닫기
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !rangeValid}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
            {loading ? '생성 중...' : '엑셀 생성'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 그리드를 exceljs 워크북으로 렌더링하고 다운로드 트리거.
// exceljs는 동적 import — 초기 번들 보호.
async function generateWorkbook({ weeks, year, month }) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()

  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
  const AMBER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
  const BLUE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }

  for (const wk of weeks) {
    const ws = workbook.addWorksheet(wk.name)

    // 1행: 헤더 (첫 칸 '시간대' + 날짜 라벨)
    const headerLabels = ['시간대', ...wk.days.map((d) => d.label || '')]
    const headerRow = ws.addRow(headerLabels)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true }
      cell.fill = HEADER_FILL
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    // 데이터 행: 1열 = 시간대 라벨, 이후 = 날짜별 셀
    for (const row of wk.rows) {
      const cellTexts = row.cells.map((c) =>
        c.entries
          .map((e) => (e.tags.length ? `${e.text} [${e.tags.join('/')}]` : e.text))
          .join('\n')
      )
      const excelRow = ws.addRow([row.slotLabel, ...cellTexts])

      // 시간대 라벨 셀
      const labelCell = excelRow.getCell(1)
      labelCell.font = { bold: true }
      labelCell.fill = HEADER_FILL
      labelCell.alignment = { horizontal: 'center', vertical: 'top' }

      // 데이터 셀 스타일 + 태그 배경
      row.cells.forEach((c, i) => {
        const cell = excelRow.getCell(i + 2)
        cell.alignment = { wrapText: true, vertical: 'top' }
        const hasLate = c.entries.some((e) => e.tags.includes('지각'))
        const hasEarly = c.entries.some((e) => e.tags.includes('조퇴'))
        if (hasLate) cell.fill = AMBER_FILL
        else if (hasEarly) cell.fill = BLUE_FILL
      })
    }

    // 열 너비
    ws.getColumn(1).width = 14
    for (let i = 2; i <= wk.days.length + 1; i++) ws.getColumn(i).width = 22
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `출결_${year}-${String(month).padStart(2, '0')}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
