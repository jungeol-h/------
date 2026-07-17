// 학부모 예약 탭 — 대시보드가 내려준 자녀(child)를 예약 대상 학생으로 사용.
// 예약 제한은 학생 기준 통합 적용이므로 화면 로직은 학생 뷰와 완전히 동일하다 (명세 3.2).
import { BookingProvider } from '../../booking/BookingContext.jsx'
import BookingGate from '../../booking/components/BookingGate.jsx'
import StudentBookingView from '../../booking/views/StudentBookingView.jsx'

export default function ParentBookingTab({ child }) {
  return (
    <BookingProvider>
      <BookingGate>
        <StudentBookingView
          key={child.id}
          student={{ id: child.id, name: child.name, groups: child.groups ?? [] }}
        />
      </BookingGate>
    </BookingProvider>
  )
}
