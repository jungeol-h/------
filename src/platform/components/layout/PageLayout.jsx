import { AlertTriangle } from 'lucide-react'
import Header from './Header.jsx'
import TabBar from './TabBar.jsx'
import { useData } from '../../context/DataContext.jsx'

export default function PageLayout({ title, badge, tabs, children }) {
  const { data } = useData()
  const fetchErrors = data._fetchErrors ?? []

  return (
    <div className="min-h-screen bg-gray-50 print:min-h-0 print:bg-white">
      <Header title={title} badge={badge} />
      <main className="max-w-lg mx-auto pt-14 pb-20 px-4 min-h-screen print:max-w-none print:mx-0 print:pt-0 print:pb-0 print:px-0 print:min-h-0">
        {fetchErrors.length > 0 && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 print:hidden">
            <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-red-700">
                일부 데이터를 불러오지 못했습니다 ({fetchErrors.length}개 항목)
              </p>
              <p className="text-[11px] text-red-600 mt-0.5">
                화면을 새로고침해 주세요. 계속되면 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        )}
        {children}
      </main>
      <TabBar tabs={tabs} />
    </div>
  )
}
