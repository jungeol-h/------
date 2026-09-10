import { AlertTriangle, RefreshCw } from 'lucide-react'
import Header from './Header.jsx'
import TabBar from './TabBar.jsx'
import NoticePopup from '../common/NoticePopup.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

export default function PageLayout({ title, badge, tabs, children, wide = false }) {
  const { data, refetch, refreshing } = useData()
  const { currentUser } = useAuth()
  const fetchErrors = data._fetchErrors ?? []

  // wide=true: 관리자/매니저 운영 화면용 노션 스타일 풀폭. 기본은 학생 모바일 퍼스트(max-w-lg).
  const mainWidth = wide ? 'max-w-7xl px-6' : 'max-w-lg px-4'

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      {currentUser && <NoticePopup />}
      <Header title={title} badge={badge} />
      <main className={`${mainWidth} mx-auto pt-14 pb-20 min-h-screen print:max-w-none print:mx-0 print:pt-0 print:pb-0 print:px-0 print:min-h-0`}>
        {fetchErrors.length > 0 && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 print:hidden">
            <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-red-700">
                일부 데이터를 불러오지 못했습니다 ({fetchErrors.length}개 항목)
              </p>
              <p className="text-[11px] text-red-600 mt-0.5">
                다시 불러오기를 눌러 주세요. 계속되면 관리자에게 문의하세요.
              </p>
              {/* PWA는 브라우저 새로고침 UI가 없다 — 배너 안에서 직접 복구 수단 제공 */}
              <button
                type="button"
                onClick={refetch}
                disabled={refreshing}
                className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 text-[11px] font-bold text-white active:scale-95 disabled:opacity-60 transition"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? '불러오는 중…' : '다시 불러오기'}
              </button>
            </div>
          </div>
        )}
        {children}
      </main>
      <TabBar tabs={tabs} />
    </div>
  )
}
