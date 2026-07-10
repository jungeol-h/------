import { RefreshCw } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'

// 데이터 전체 refetch 버튼 — 다른 세션의 변경(학생 제출 등)을 수동으로 반영한다.
export default function RefreshButton({ className = '' }) {
  const { refetch, refreshing } = useData()

  return (
    <button
      type="button"
      onClick={refetch}
      disabled={refreshing}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed transition ${className}`}
    >
      <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
      {refreshing ? '불러오는 중…' : '새로고침'}
    </button>
  )
}
