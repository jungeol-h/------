// 강사 예약관리 탭 — booking 격리 모듈의 얇은 래퍼 (instructor·consultant·manager 공용)
import { BookingProvider } from '../../booking/BookingContext.jsx'
import BookingGate from '../../booking/components/BookingGate.jsx'
import EducatorBookingView from '../../booking/views/EducatorBookingView.jsx'

export default function EducatorBookingTab() {
  return (
    <BookingProvider>
      <BookingGate>
        <EducatorBookingView />
      </BookingGate>
    </BookingProvider>
  )
}
