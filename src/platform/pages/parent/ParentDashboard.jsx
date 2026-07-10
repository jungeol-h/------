import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Home, BarChart2, MessageSquare, Loader, Users } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useData } from '../../context/DataContext.jsx'
import ParentHomeTab from './ParentHomeTab.jsx'
import ParentLearningTab from './ParentLearningTab.jsx'
import ParentCommentTab from './ParentCommentTab.jsx'

const TABS = [
  { path: '/parent/home', label: '홈', icon: Home },
  { path: '/parent/learning', label: '학습', icon: BarChart2 },
  { path: '/parent/comments', label: '코멘트', icon: MessageSquare },
]

export default function ParentDashboard() {
  const { data, loading } = useData()
  const children = data.students ?? []
  const [selectedChildId, setSelectedChildId] = useState(null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <Loader size={32} className="animate-spin" />
          <p className="text-sm">데이터 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 자녀 0명 — 빈 상태
  if (children.length === 0) {
    return (
      <PageLayout title="학부모" tabs={TABS}>
        <div className="py-16 flex flex-col items-center text-center gap-3 text-gray-400">
          <Users size={40} className="text-gray-300" />
          <p className="text-sm font-semibold text-gray-500">연결된 자녀가 없습니다.</p>
          <p className="text-xs text-gray-400">센터에 문의해주세요.</p>
        </div>
      </PageLayout>
    )
  }

  // 선택된 자녀 결정 (기본: 첫 자녀)
  const activeChild = children.find((c) => c.id === selectedChildId) ?? children[0]

  // 자녀 2명 이상일 때만 선택 세그먼트 노출
  const childSelector = children.length > 1 ? (
    <div className="flex gap-1.5 flex-wrap pt-4">
      {children.map((c) => {
        const selected = c.id === activeChild.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedChildId(c.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
              selected
                ? 'bg-rose-500 text-white'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {c.name}
          </button>
        )
      })}
    </div>
  ) : null

  return (
    <PageLayout title="학부모" tabs={TABS}>
      {childSelector}
      <Routes>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<ParentHomeTab child={activeChild} />} />
        <Route path="learning" element={<ParentLearningTab child={activeChild} />} />
        <Route path="comments" element={<ParentCommentTab child={activeChild} />} />
        <Route path="*" element={<Navigate to="home" replace />} />
      </Routes>
    </PageLayout>
  )
}
