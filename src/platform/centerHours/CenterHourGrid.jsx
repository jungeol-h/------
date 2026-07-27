// 요일×1시간 단위 선택 그리드 (프레젠테이션 전용) — WeeklySlotPicker 스타일 승계.
// 요일마다 단위 시각이 달라(주중 16시~, 주말 12:30~) 시간축을 공유하지 않고
// 각 셀 안에 시작 시각을 표기한다.

import { CENTER_HOUR_UNITS, CENTER_DAY_LABEL, DEFAULT_OPERATING_DAYS, operatingDayOrder, unitKey } from '../data/centerHours.js'

// selected: Set(unitKey) · othersCount: { [unitKey]: 본인 제외 등록 수 }
// ignoreCapacity: 관리자 대리 수정 — 마감 셀도 토글 가능
// days: 운영 요일 (admin_config operatingDays — 표시 순서 정렬은 여기서 처리)
export default function CenterHourGrid({
  selected, othersCount, capacity, editable, ignoreCapacity = false, onToggle,
  days = DEFAULT_OPERATING_DAYS,
}) {
  const dayOrder = operatingDayOrder(days)
  const maxRows = Math.max(...dayOrder.map((d) => CENTER_HOUR_UNITS[d].length))

  return (
    <div className="bg-white rounded-2xl shadow-sm p-2">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${dayOrder.length}, 1fr)` }}>
        {dayOrder.map((day) => (
          <div key={day} className="text-center py-1">
            <p className={`text-[11px] font-bold ${day === 0 ? 'text-red-400' : 'text-gray-600'}`}>
              {CENTER_DAY_LABEL[day]}
            </p>
          </div>
        ))}
        {Array.from({ length: maxRows }, (_, row) =>
          dayOrder.map((day) => {
            const unit = CENTER_HOUR_UNITS[day][row]
            if (!unit) return <div key={`${day}-${row}`} className="h-11 rounded-md bg-gray-50/60" />
            const k = unitKey(day, unit.start)
            const isSelected = selected.has(k)
            const others = othersCount[k] ?? 0
            const remaining = Math.max(0, capacity - others - (isSelected ? 1 : 0))
            const isFull = !isSelected && others >= capacity
            const clickable = editable && (!isFull || ignoreCapacity)

            let style = 'bg-gray-100 text-gray-500'
            if (isSelected) style = 'bg-blue-600 text-white font-bold'
            else if (isFull) style = 'bg-gray-200/70 text-gray-400'
            else if (editable) style = 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'

            return (
              <button
                key={k}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onToggle(day, unit)}
                className={`h-11 rounded-md flex flex-col items-center justify-center leading-tight transition-all ${style} ${clickable ? 'cursor-pointer active:scale-95' : ''}`}
              >
                <span className="text-[11px] font-bold">{unit.start}</span>
                <span className="text-[9px] opacity-80">
                  {isFull ? '마감' : `잔여 ${remaining}`}
                </span>
              </button>
            )
          }),
        )}
      </div>
      <div className="flex gap-3 items-center justify-end pt-1.5 pr-1 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block" />선택 가능</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-gray-200 inline-block" />마감</span>
        <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-blue-600 inline-block" />내 이용시간</span>
      </div>
    </div>
  )
}
