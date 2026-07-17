// 예약 모듈 공통 로딩·오류 게이트. 마이그레이션 미적용 등 fetch 실패 시
// 기존 화면(_fetchErrors 배너)에 영향 없이 이 모듈 안에서만 오류를 표시한다.
import { Loader, CalendarX } from 'lucide-react'
import { useBooking } from '../BookingContext.jsx'

export default function BookingGate({ children }) {
  const { loading, error, refetch } = useBooking()

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
        <Loader size={28} className="animate-spin" />
        <p className="text-sm">예약 정보를 불러오는 중...</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
        <CalendarX size={28} className="text-gray-300" />
        <p className="text-sm font-semibold text-gray-500">예약 시스템을 준비 중입니다</p>
        <p className="text-xs">잠시 후 다시 시도하거나 관리자에게 문의해 주세요.</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-2 px-4 h-9 rounded-lg bg-gray-100 text-xs font-bold text-gray-600"
        >
          다시 시도
        </button>
      </div>
    )
  }
  return children
}
