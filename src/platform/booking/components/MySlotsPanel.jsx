// 내 슬롯 패널 — 가용시간 규칙 + 강사지정예약 + 주간 슬롯 목록.
// EducatorBookingView '내 슬롯' 메뉴에서 추출해 AdminBookingView '내 슬롯' 메뉴와
// 공용 (2026-07-31 클라이언트 요청: 관리자도 본인 슬롯·강사지정예약이 필요 —
// 관리자 스코프 fetch는 전 강사 슬롯이므로 여기서 educatorId로 본인분만 거른다).

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useBooking } from '../BookingContext.jsx'
import { addDaysStr } from '../bookingRules.js'
import { todayStr } from '../../utils/dateUtils.js'
import { SLOT_STATUS } from '../bookingStatus.js'
import AvailabilityRulesSection from './AvailabilityRulesSection.jsx'
import SlotEditorModal from './SlotEditorModal.jsx'
import DesignatedReserveModal from './DesignatedReserveModal.jsx'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function dowOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEKDAY[new Date(y, m - 1, d).getDay()]
}

export default function MySlotsPanel({ educatorId, programs, isAdmin = false }) {
  const { config, slots, reservations, userNames } = useBooking()

  const [weekStart, setWeekStart] = useState(() => {
    // 이번 주 월요일
    const now = new Date()
    const day = now.getDay()
    return addDaysStr(todayStr(), day === 0 ? -6 : 1 - day)
  })
  const [editSlot, setEditSlot] = useState(null)
  const [designatedOpen, setDesignatedOpen] = useState(false)

  const programOf = (id) => config.programs.find((p) => p.id === id)
  const subjectName = (id) => config.subjects.find((s) => s.id === id)?.name ?? ''
  const studentName = (id) => userNames[id]?.name ?? id
  const confirmedOf = (slotId) => reservations.filter((r) => r.slotId === slotId && r.status === 'confirmed')

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i)),
    [weekStart],
  )
  const weekSlots = useMemo(
    () => slots
      .filter((s) => s.educatorId === educatorId && s.date >= weekDates[0] && s.date <= weekDates[6])
      .sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : a.date < b.date ? -1 : 1)),
    [slots, weekDates, educatorId],
  )

  return (
    <div className="space-y-3">
      {/* 예약 가능 시간의 단일 홈 — 매주 반복(규칙) + 특정 날짜 추가.
          아래 주간 목록은 그 결과를 확인·수정하는 달력 뷰다 */}
      <AvailabilityRulesSection educatorId={educatorId} />

      {/* 강사지정예약 — 학생·시간 지정 고정 예약 (반복 가능). 지정된 시간대에는
          타임테이블이 예약 가능 시간을 만들지 않는다 (2026-07-30 클라이언트 요청) */}
      {programs.length > 0 && (
        <button
          type="button"
          onClick={() => setDesignatedOpen(true)}
          className="w-full h-10 rounded-xl border border-dashed border-indigo-300 text-indigo-600 text-xs font-bold flex items-center justify-center gap-1"
        >
          <Plus size={14} /> 강사지정예약 — 학생·시간을 지정해 고정
        </button>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={() => setWeekStart(addDaysStr(weekStart, -7))} className="p-2 rounded-lg bg-gray-100"><ChevronLeft size={16} /></button>
        <p className="text-sm font-bold text-gray-700">{weekDates[0]} ~ {weekDates[6]}</p>
        <button type="button" onClick={() => setWeekStart(addDaysStr(weekStart, 7))} className="p-2 rounded-lg bg-gray-100"><ChevronRight size={16} /></button>
      </div>
      {weekDates.map((d) => {
        const daySlots = weekSlots.filter((s) => s.date === d)
        if (daySlots.length === 0) return null
        return (
          <div key={d} className="space-y-1.5">
            <h4 className="text-xs font-bold text-gray-400">{d} ({dowOf(d)})</h4>
            {daySlots.map((s) => {
              const booked = confirmedOf(s.id)
              const status = SLOT_STATUS[s.status]
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setEditSlot(s)}
                  className="w-full bg-white rounded-xl shadow-sm p-3 text-left flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {s.startTime}~{s.endTime}
                      <span className="ml-1.5 text-xs font-semibold text-gray-500">{programOf(s.programId)?.name}</span>
                      {s.subjectId && <span className="ml-1 text-xs text-emerald-600">{subjectName(s.subjectId)}</span>}
                      {s.ruleId && <span className="ml-1 text-[10px] font-bold text-indigo-400">자동</span>}
                      {!s.isPublic && <span className="ml-1 text-[10px] text-gray-400">비공개</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {booked.length}/{s.capacity}명
                      {booked.length > 0 && ` · ${booked.map((r) => studentName(r.studentId)).join(', ')}`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${status?.color}`}>
                    {status?.label}
                  </span>
                </button>
              )
            })}
          </div>
        )
      })}
      {weekSlots.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">이번 주 슬롯이 없습니다.</p>
      )}

      {editSlot && (
        <SlotEditorModal
          slot={editSlot}
          program={programOf(editSlot.programId)}
          isAdmin={isAdmin}
          onClose={() => setEditSlot(null)}
        />
      )}
      {designatedOpen && (
        <DesignatedReserveModal
          educatorId={educatorId}
          programs={programs}
          onClose={() => setDesignatedOpen(false)}
        />
      )}
    </div>
  )
}
