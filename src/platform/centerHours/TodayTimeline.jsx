// 오늘 시간대별 현황 — 센터 이용시간 등록(registrations)과 오늘 출결 상태(board)를
// 결합해 "이 시간대에 있어야 할 학생 중 누가 와 있나"를 단위별로 보여준다.
// 현재 시간대는 강조 + 자동 펼침. 상태색은 항상 그룹 라벨과 함께 쓴다.

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CENTER_HOUR_UNITS, unitKey, unitLabel } from '../data/centerHours.js'
import { timeToMinutes } from '../context/selectors/attendance.js'

// board 상태 → 타임라인 그룹
const GROUP_OF = {
  present: 'in', late: 'in',
  not_arrived: 'missing', absent: 'missing',
  checked_out: 'out', early_leave: 'out',
  waiting: 'wait', no_schedule: 'wait',
}
const GROUPS = [
  { key: 'in', label: '등원', bar: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50' },
  { key: 'missing', label: '미등원', bar: 'bg-red-500', text: 'text-red-700', chip: 'bg-red-50' },
  { key: 'out', label: '하원', bar: 'bg-blue-500', text: 'text-blue-700', chip: 'bg-blue-50' },
  { key: 'wait', label: '등원 전', bar: 'bg-gray-300', text: 'text-gray-500', chip: 'bg-gray-50' },
]

export default function TodayTimeline({ registrations, board, now = new Date() }) {
  const dow = now.getDay()
  const units = CENTER_HOUR_UNITS[dow]
  const [expanded, setExpanded] = useState(null) // unit.start | null(=현재 시간대 자동)

  // studentId → { student, status }
  const statusById = useMemo(() => {
    const map = new Map()
    for (const [status, entries] of Object.entries(board)) {
      for (const e of entries) map.set(e.student.id, { student: e.student, status })
    }
    return map
  }, [board])

  const nowMin = now.getHours() * 60 + now.getMinutes()

  const rows = useMemo(() => {
    if (!units) return []
    return units.map((unit) => {
      const expected = registrations
        .filter((r) => r.dayOfWeek === dow && r.startTime === unit.start)
        .map((r) => statusById.get(r.studentId))
        .filter(Boolean)
        .sort((a, b) => a.student.name.localeCompare(b.student.name, 'ko'))
      const byGroup = { in: [], missing: [], out: [], wait: [] }
      for (const e of expected) byGroup[GROUP_OF[e.status] ?? 'wait'].push(e)
      const startMin = timeToMinutes(unit.start)
      const endMin = timeToMinutes(unit.end)
      return {
        unit,
        key: unitKey(dow, unit.start),
        expected,
        byGroup,
        isCurrent: nowMin >= startMin && nowMin < endMin,
        isPast: nowMin >= endMin,
      }
    })
  }, [units, registrations, dow, statusById, nowMin])

  if (!units) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-5 text-center text-sm text-gray-400">
        오늘은 센터 운영 요일이 아닙니다 (운영: 월·화·금·토·일)
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map(({ unit, key, expected, byGroup, isCurrent, isPast }) => {
        const isExpanded = expanded === null ? isCurrent : expanded === unit.start
        return (
          <div
            key={key}
            className={`bg-white rounded-2xl shadow-sm ${
              isCurrent ? 'ring-2 ring-indigo-400' : isPast ? 'opacity-70' : ''
            }`}
          >
            <button
              onClick={() => setExpanded(isExpanded ? '' : unit.start)}
              className="w-full px-4 py-3 flex items-center gap-3"
            >
              <span className={`text-xs font-bold ${isCurrent ? 'text-indigo-600' : 'text-gray-700'}`}>
                {unitLabel(unit)}
              </span>
              {isCurrent && (
                <span className="text-[10px] font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded-full">
                  지금
                </span>
              )}
              <span className="text-[11px] text-gray-400 ml-auto">
                {expected.length === 0
                  ? '예정 없음'
                  : `등원 ${byGroup.in.length} / 예정 ${expected.length}`}
              </span>
              {expected.length > 0 && (
                isExpanded ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />
              )}
            </button>

            {/* 구성 비율 바 — 세그먼트 간 2px 간격, 수치는 펼침 영역의 라벨로 표기 */}
            {expected.length > 0 && (
              <div className="px-4 pb-3 -mt-1">
                <div className="flex gap-0.5 h-1.5">
                  {GROUPS.map(({ key: g, bar }) =>
                    byGroup[g].length > 0 && (
                      <div
                        key={g}
                        className={`${bar} rounded-full`}
                        style={{ flexGrow: byGroup[g].length }}
                      />
                    ))}
                </div>
              </div>
            )}

            {isExpanded && expected.length > 0 && (
              <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
                {GROUPS.map(({ key: g, label, text, chip, bar }) =>
                  byGroup[g].length > 0 && (
                    <div key={g} className="flex gap-2">
                      <span className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold ${text} w-16`}>
                        <i className={`w-1.5 h-1.5 rounded-full ${bar}`} />
                        {label} {byGroup[g].length}
                      </span>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {byGroup[g].map((e) => (
                          <span key={e.student.id} className={`inline-block px-1.5 py-0.5 rounded-md mb-0.5 mr-0.5 ${chip}`}>
                            {e.student.name}
                          </span>
                        ))}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
