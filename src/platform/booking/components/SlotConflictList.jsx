// 겹침(중복) 슬롯 목록 — TimetableWizard·RuleModal이 "겹쳐서 못 만든 슬롯"이
// 무엇인지 보여줄 때 공용으로 쓴다 (2026-09 클라이언트 요청: 겹침 차단을 눈에
// 보이게 하고 그 자리에서 해소). AdminBookingView TimetableMenu·MySlotsPanel의
// 슬롯 행 표기(상태 칩·자동/강사지정/비공개 배지·예약 수)를 그대로 따른다.

import { useBooking } from '../BookingContext.jsx'
import { SLOT_STATUS } from '../bookingStatus.js'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function dowOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return WEEKDAY[new Date(y, m - 1, d).getDay()]
}

// blockers: 고유 슬롯 배열 (중복 제거는 호출측 책임)
// onEdit(slot): 있으면 각 행에 [편집] 버튼 노출 (SlotEditorModal 여는 용도)
export default function SlotConflictList({ blockers, onEdit }) {
  const { config, reservations, userNames } = useBooking()

  const programName = (id) => config.programs.find((p) => p.id === id)?.name ?? id
  const confirmedOf = (slotId) => reservations.filter((r) => r.slotId === slotId && r.status === 'confirmed')

  const sorted = [...blockers].sort((a, b) => (a.date === b.date
    ? (a.startTime < b.startTime ? -1 : 1)
    : a.date < b.date ? -1 : 1))

  return (
    <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-xl bg-gray-50 p-2">
      {sorted.map((s) => {
        const status = SLOT_STATUS[s.status]
        const booked = confirmedOf(s.id)
        return (
          <div key={s.id} className="bg-white rounded-lg shadow-sm p-2.5 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-900 truncate">
                {s.date} ({dowOf(s.date)}) {s.startTime}~{s.endTime}
                <span className="ml-1.5 font-semibold text-gray-500">{programName(s.programId)}</span>
                {s.ruleId && <span className="ml-1 text-[10px] font-bold text-indigo-400">자동</span>}
                {s.note === '강사지정' && <span className="ml-1 text-[10px] font-bold text-indigo-400">강사지정</span>}
                {s.isPublic === false && <span className="ml-1 text-[10px] text-gray-400">비공개</span>}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                {userNames[s.educatorId]?.name ?? '강사 미지정'} · {booked.length}/{s.capacity}명
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${status?.color}`}>
              {status?.label ?? s.status}
            </span>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(s)}
                className="flex-shrink-0 text-[11px] font-bold text-blue-600 px-2 py-1"
              >
                편집
              </button>
            )}
          </div>
        )
      })}
      {sorted.length === 0 && (
        <p className="py-4 text-center text-xs text-gray-400">겹치는 슬롯이 없습니다.</p>
      )}
    </div>
  )
}
