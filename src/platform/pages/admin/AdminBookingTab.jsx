// 관리자 예약 탭 — booking 격리 모듈의 얇은 래퍼
import { BookingProvider } from '../../booking/BookingContext.jsx'
import BookingGate from '../../booking/components/BookingGate.jsx'
import AdminBookingView from '../../booking/views/AdminBookingView.jsx'

export default function AdminBookingTab() {
  return (
    <BookingProvider>
      <BookingGate>
        <AdminBookingView />
      </BookingGate>
    </BookingProvider>
  )
}
