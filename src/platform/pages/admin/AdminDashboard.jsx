import { Routes, Route, Navigate } from 'react-router-dom'
import { Home, BarChart2, UserCog, Loader } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useData } from '../../context/DataContext.jsx'
import AdminHomeTab from './AdminHomeTab.jsx'
import StatisticsTab from './StatisticsTab.jsx'
import UserManagementTab from './UserManagementTab.jsx'

const TABS = [
  { path: '/admin/home', label: '홈', icon: Home },
  { path: '/admin/statistics', label: '통계', icon: BarChart2 },
  { path: '/admin/users', label: '사용자', icon: UserCog },
]

export default function AdminDashboard() {
  const { loading } = useData()

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

  return (
    <PageLayout title="관리자" tabs={TABS}>
      <Routes>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<AdminHomeTab />} />
        <Route path="statistics" element={<StatisticsTab />} />
        <Route path="users" element={<UserManagementTab />} />
      </Routes>
    </PageLayout>
  )
}
