// 학생 예약 탭 — booking 격리 모듈의 얇은 래퍼 (데이터는 BookingProvider가 lazy fetch)
import { useAuth } from '../../context/AuthContext.jsx'
import { BookingProvider } from '../../booking/BookingContext.jsx'
import BookingGate from '../../booking/components/BookingGate.jsx'
import StudentBookingView from '../../booking/views/StudentBookingView.jsx'

export default function BookingTab() {
  const { currentUser } = useAuth()
  return (
    <BookingProvider>
      <BookingGate>
        <StudentBookingView
          student={{ id: currentUser.id, name: currentUser.name, groups: currentUser.groups ?? [] }}
        />
      </BookingGate>
    </BookingProvider>
  )
}
