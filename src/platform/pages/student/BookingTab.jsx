// 학생 예약 탭 — 상단 세그먼트로 상담 예약(booking 격리 모듈)과
// 센터 이용시간 등록(centerHours 격리 모듈)을 전환한다.
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { BookingProvider } from '../../booking/BookingContext.jsx'
import BookingGate from '../../booking/components/BookingGate.jsx'
import StudentBookingView from '../../booking/views/StudentBookingView.jsx'
import StudentCenterHoursView from '../../centerHours/StudentCenterHoursView.jsx'

const SEGMENTS = [
  { key: 'booking', label: '상담 예약' },
  { key: 'centerHours', label: '센터 이용시간' },
]

export default function BookingTab() {
  const { currentUser } = useAuth()
  const [segment, setSegment] = useState('booking')

  return (
    <div className="py-4 space-y-4">
      <div className="flex bg-gray-100 rounded-2xl p-1">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSegment(s.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              segment === s.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {segment === 'booking' ? (
        <BookingProvider>
          <BookingGate>
            <StudentBookingView
              student={{ id: currentUser.id, name: currentUser.name, groups: currentUser.groups ?? [] }}
            />
          </BookingGate>
        </BookingProvider>
      ) : (
        <StudentCenterHoursView student={{ id: currentUser.id, name: currentUser.name }} />
      )}
    </div>
  )
}
