// 날짜별 출결 현황 패널 (LMS식) — 상태 요약 타일 + 필터 칩 + 명단 테이블.
// 데이터는 getDailyAttendanceBoard 결과(board)를 그대로 받는 프레젠테이션 계층.
// isToday=false(지난 날짜)면 '오늘' 문구만 중립화한다 — 분류는 셀렉터 책임.
// 상태색은 항상 라벨과 함께 쓴다(색 단독 식별 금지).

import { useMemo, useState } from 'react'
import { Pencil, Search } from 'lucide-react'
import { ATTENDANCE_STATUS_META, ATTENDANCE_STATUS_ORDER } from './attendanceStatusMeta.js'

const hhmm = (iso) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '')

function StatusChip({ status }) {
  const meta = ATTENDANCE_STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${meta.chip}`}>
      <i className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

export default function TodayAttendancePanel({ board, onEditRecord, isToday = true }) {
  const [filter, setFilter] = useState('scheduled') // 'scheduled' | status key
  const [query, setQuery] = useState('')

  // board → 평탄화 (상태순 → 예정시간순 → 이름순)
  const rows = useMemo(() => {
    const out = []
    for (const status of ATTENDANCE_STATUS_ORDER) {
      const entries = (board[status] ?? []).slice().sort((a, b) =>
        (a.schedule?.arrivalTime ?? '99:99').localeCompare(b.schedule?.arrivalTime ?? '99:99') ||
        a.student.name.localeCompare(b.student.name, 'ko'))
      for (const e of entries) out.push({ ...e, status })
    }
    return out
  }, [board])

  const countOf = (status) => (board[status] ?? []).length
  const scheduledTotal = rows.length - countOf('no_schedule')
  const scheduledLabel = isToday ? '오늘 예정' : '등원 예정'
  const tiles = [
    { label: scheduledLabel, value: scheduledTotal, accent: 'border-indigo-200' },
    { label: isToday ? '등원 중' : '등원', value: countOf('present') + countOf('late'), accent: 'border-emerald-200' },
    { label: '미등원·결석', value: countOf('not_arrived') + countOf('absent'), accent: 'border-red-200' },
    { label: '하원 완료', value: countOf('checked_out') + countOf('early_leave'), accent: 'border-blue-200' },
  ]

  const visible = rows.filter((r) => {
    if (filter === 'scheduled' && r.status === 'no_schedule') return false
    if (filter !== 'scheduled' && r.status !== filter) return false
    if (query && !r.student.name.includes(query.trim())) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* 요약 타일 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className={`bg-white rounded-2xl shadow-sm border-l-4 ${t.accent} px-4 py-3`}>
            <p className="text-[11px] text-gray-400 font-medium">{t.label}</p>
            <p className="text-2xl font-bold text-gray-800 leading-tight">
              {t.value}<span className="text-xs font-medium text-gray-400 ml-0.5">명</span>
            </p>
          </div>
        ))}
      </div>

      {/* 필터 칩 + 검색 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFilter('scheduled')}
          className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
            filter === 'scheduled' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 shadow-sm'
          }`}
        >
          {scheduledLabel} {scheduledTotal}
        </button>
        {ATTENDANCE_STATUS_ORDER.map((status) => {
          const n = countOf(status)
          if (n === 0) return null
          const meta = ATTENDANCE_STATUS_META[status]
          return (
            <button
              key={status}
              onClick={() => setFilter(filter === status ? 'scheduled' : status)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all inline-flex items-center gap-1.5 ${
                filter === status ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 shadow-sm'
              }`}
            >
              <i className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label} {n}
            </button>
          )
        })}
        <div className="relative ml-auto">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름 검색"
            className="w-32 sm:w-40 border border-gray-200 rounded-full pl-7 pr-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
      </div>

      {/* 명단 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-[11px] text-gray-400 border-b border-gray-100">
              <th className="text-left font-medium px-4 py-2.5">학생</th>
              <th className="text-left font-medium px-3 py-2.5 w-24">상태</th>
              <th className="text-left font-medium px-3 py-2.5 w-28">예정</th>
              <th className="text-left font-medium px-3 py-2.5 w-16">등원</th>
              <th className="text-left font-medium px-3 py-2.5 w-16">하원</th>
              <th className="text-left font-medium px-3 py-2.5">비고</th>
              <th className="px-3 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {visible.map(({ student, record, schedule, status }) => (
              <tr key={student.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-gray-800">{student.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {[student.school, student.grade].filter(Boolean).join(' ')}
                  </p>
                </td>
                <td className="px-3 py-2.5"><StatusChip status={status} /></td>
                <td className="px-3 py-2.5 text-xs text-gray-500">
                  {schedule ? `${schedule.arrivalTime}~${schedule.departureTime}` : '—'}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{hhmm(record?.checkInAt) || '—'}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{hhmm(record?.checkOutAt) || '—'}</td>
                <td className="px-3 py-2.5 text-[11px] text-gray-400 max-w-[180px] truncate">
                  {record?.note ?? ''}
                </td>
                <td className="px-3 py-2.5">
                  {record && onEditRecord && (
                    <button
                      onClick={() => onEditRecord({ student, record })}
                      className="p-1.5 text-gray-300 hover:text-gray-500"
                      aria-label={`${student.name} 출결 정정`}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  조건에 맞는 학생이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
