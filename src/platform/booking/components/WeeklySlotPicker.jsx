// '되는시간'식 주간 타임테이블 — 요일×시간 그리드에서 가능/마감/내 예약을
// 색으로 한눈에 보여주고, 셀 한 번 탭으로 예약 확정 시트를 연다 (명세 21.1).
// 같은 시간에 강사가 여럿이면 onPickMany로 강사 선택 시트를 띄운다.

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayStr } from '../../utils/dateUtils.js'
import { addDaysStr, slotStartDate } from '../bookingRules.js'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function dowOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
const mondayOf = (dateStr) => {
  const dow = dowOf(dateStr)
  return addDaysStr(dateStr, dow === 0 ? -6 : 1 - dow)
}

// adminMode: 관리자 대리예약용 — 마감 셀도 탭 가능(정원 초과는 예외 처리로 RPC가 판단)
export default function WeeklySlotPicker({ slots, slotCounts, myReservations, onPick, onPickMany, adminMode = false }) {
  // 오늘 이후 첫 예약 가능일이 속한 주에서 시작
  const firstDate = useMemo(() => {
    const t = todayStr()
    const ds = slots.map((s) => s.date).filter((d) => d >= t).sort()
    return ds[0] ?? t
  }, [slots])
  const [weekStart, setWeekStart] = useState(() => mondayOf(firstDate))

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i)),
    [weekStart],
  )
  const weekSlots = useMemo(
    () => slots.filter((s) => s.date >= weekDates[0] && s.date <= weekDates[6]),
    [slots, weekDates],
  )
  const rows = useMemo(
    () => [...new Set(weekSlots.map((s) => s.startTime))].sort(),
    [weekSlots],
  )
  const myConfirmedSlotIds = useMemo(
    () => new Set(myReservations.filter((r) => r.status === 'confirmed').map((r) => r.slotId)),
    [myReservations],
  )

  const now = new Date()
  const today = todayStr()
  const cellOf = (date, time) => weekSlots.filter((s) => s.date === date && s.startTime === time)

  const cellState = (cellSlots) => {
    if (cellSlots.length === 0) return { kind: 'none' }
    if (cellSlots.some((s) => myConfirmedSlotIds.has(s.id))) return { kind: 'mine' }
    if (slotStartDate(cellSlots[0]) <= now) return { kind: 'past' }
    const remaining = cellSlots.reduce(
      (sum, s) => sum + Math.max(0, s.capacity - (slotCounts[s.id] ?? 0)), 0)
    if (remaining <= 0) return { kind: 'full' }
    const group = cellSlots.some((s) => s.capacity > 1)
    return { kind: 'open', remaining, group }
  }

  const CELL_STYLE = {
    none: 'bg-gray-50/60',
    past: 'bg-gray-50 text-gray-300',
    full: 'bg-gray-200/70 text-gray-400',
    mine: 'bg-blue-600 text-white font-bold',
    open: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold cursor-pointer',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setWeekStart(addDaysStr(weekStart, -7))}
          className="p-2 rounded-lg bg-gray-100"
          aria-label="이전 주"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-bold text-gray-700">
          {weekDates[0].slice(5).replace('-', '/')} ~ {weekDates[6].slice(5).replace('-', '/')}
        </p>
        <button
          type="button"
          onClick={() => setWeekStart(addDaysStr(weekStart, 7))}
          className="p-2 rounded-lg bg-gray-100"
          aria-label="다음 주"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">
          이 주에는 예약 가능한 시간이 없습니다. 다른 주를 확인해 주세요.
        </p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-2">
          {/* 요일 헤더 */}
          <div className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: '44px repeat(7, 1fr)' }}>
            <div />
            {weekDates.map((d) => {
              const dow = dowOf(d)
              return (
                <div key={d} className={`text-center py-1 ${d === today ? 'rounded-lg bg-blue-50' : ''}`}>
                  <p className={`text-[10px] ${dow === 0 ? 'text-red-400' : 'text-gray-400'}`}>{WEEKDAY[dow]}</p>
                  <p className={`text-[11px] font-bold ${d === today ? 'text-blue-600' : 'text-gray-700'}`}>
                    {Number(d.slice(8))}
                  </p>
                </div>
              )
            })}
          </div>
          {/* 시간 행 */}
          {rows.map((time) => (
            <div key={time} className="grid gap-0.5 mb-0.5" style={{ gridTemplateColumns: '44px repeat(7, 1fr)' }}>
              <div className="text-[10px] text-gray-400 flex items-center justify-end pr-1">{time}</div>
              {weekDates.map((d) => {
                const cellSlots = cellOf(d, time)
                const st = cellState(cellSlots)
                const clickable = st.kind === 'open' || (adminMode && st.kind === 'full')
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (!clickable) return
                      const pickable = cellSlots.filter((s) =>
                        !myConfirmedSlotIds.has(s.id) &&
                        (adminMode || (s.capacity - (slotCounts[s.id] ?? 0)) > 0))
                      if (pickable.length === 0) return
                      if (pickable.length === 1) onPick(pickable[0])
                      else onPickMany(pickable)
                    }}
                    className={`h-9 rounded-md text-[10px] flex items-center justify-center ${CELL_STYLE[st.kind]} ${
                      adminMode && st.kind === 'full' ? 'cursor-pointer hover:bg-gray-300/70' : ''
                    }`}
                  >
                    {st.kind === 'mine' && '내예약'}
                    {st.kind === 'full' && '마감'}
                    {st.kind === 'open' && (st.group ? `그룹 ${st.remaining}` : st.remaining > 1 ? `잔여 ${st.remaining}` : '')}
                  </button>
                )
              })}
            </div>
          ))}
          {/* 범례 */}
          <div className="flex gap-3 items-center justify-end pt-1.5 pr-1 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-emerald-100 inline-block" />예약 가능</span>
            <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-gray-200 inline-block" />마감</span>
            <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-blue-600 inline-block" />내 예약</span>
          </div>
        </div>
      )}
    </div>
  )
}
