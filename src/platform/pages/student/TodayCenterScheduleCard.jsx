// 학생 홈 '오늘의 센터 일정' 카드 — 오늘 상담 예약 현황(강조)과 센터 이용시간
// 등록 현황을 요약한다 (2026-07 클라이언트 요청: 홈 화면 예약 알림 강조).
// 데이터는 useTodayCenterSchedule 훅이 booking·centerHours 모듈에서 읽기 전용 fetch.

import { CalendarClock, ChevronRight, DoorOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useTodayCenterSchedule from './useTodayCenterSchedule.js'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function ReservationRows({ reservations, nowHHMM }) {
  if (reservations.loading) {
    return <p className="text-sm text-gray-400 py-2">불러오는 중...</p>
  }
  if (reservations.error) {
    return <p className="text-sm text-gray-400 py-2">예약 정보를 불러오지 못했어요</p>
  }
  if (reservations.items.length === 0) {
    return <p className="text-sm text-gray-400 py-2">오늘 예약된 상담이 없어요</p>
  }
  // 아직 끝나지 않은 첫 예약을 강조 (예약 알림)
  const nextId = reservations.items.find((r) => r.endTime > nowHHMM)?.id
  return (
    <div className="space-y-2">
      {reservations.items.map((r) => {
        const isNext = r.id === nextId
        const isPast = r.endTime <= nowHHMM
        return (
          <div
            key={r.id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
              isNext ? 'bg-indigo-50 ring-1 ring-indigo-200' : isPast ? 'opacity-50' : 'bg-gray-50'
            }`}
          >
            <div className={`text-sm font-bold whitespace-nowrap ${isNext ? 'text-indigo-600' : 'text-gray-700'}`}>
              {r.startTime}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${isNext ? 'text-indigo-800' : 'text-gray-800'}`}>
                {r.programName}
                {r.subjectName && <span className="ml-1.5 text-xs font-medium text-emerald-600">{r.subjectName}</span>}
              </p>
              <p className="text-xs text-gray-500">{r.startTime}~{r.endTime} · {r.educatorName}</p>
            </div>
            {isNext && (
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-indigo-500 text-white flex-shrink-0">
                {r.startTime <= nowHHMM ? '진행중' : '예정'}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CenterHoursRow({ centerHours }) {
  if (centerHours.loading) {
    return <p className="text-sm text-gray-400 py-2">불러오는 중...</p>
  }
  if (centerHours.error) {
    return <p className="text-sm text-gray-400 py-2">이용시간 정보를 불러오지 못했어요</p>
  }
  if (!centerHours.isOperatingDay) {
    return <p className="text-sm text-gray-400 py-2">오늘은 센터 미운영일이에요</p>
  }
  if (centerHours.units.length === 0) {
    return <p className="text-sm text-gray-400 py-2">오늘 등록된 이용시간이 없어요</p>
  }
  return (
    <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
      <DoorOpen size={18} className="text-emerald-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">
          등원 {centerHours.checkIn} · 하원 {centerHours.checkOut}
        </p>
        <p className="text-xs text-gray-500">등록 시간대 {centerHours.units.length}개</p>
      </div>
    </div>
  )
}

export default function TodayCenterScheduleCard({ studentId }) {
  const navigate = useNavigate()
  const { reservations, centerHours } = useTodayCenterSchedule(studentId)
  const now = new Date()
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <CalendarClock size={16} className="text-indigo-500" />
          오늘의 센터 일정
        </h3>
        <span className="text-xs text-gray-400">
          {now.getMonth() + 1}/{now.getDate()} ({WEEKDAY_LABELS[now.getDay()]})
        </span>
      </div>

      <div className="space-y-3">
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-bold text-gray-400">상담 예약</p>
            <button
              type="button"
              onClick={() => navigate('/student/booking')}
              className="text-xs font-semibold text-indigo-500 flex items-center"
            >
              예약하기 <ChevronRight size={13} />
            </button>
          </div>
          <ReservationRows reservations={reservations} nowHHMM={nowHHMM} />
        </section>

        <section>
          <p className="text-xs font-bold text-gray-400 mb-1.5">센터 이용시간</p>
          <CenterHoursRow centerHours={centerHours} />
        </section>
      </div>
    </div>
  )
}
