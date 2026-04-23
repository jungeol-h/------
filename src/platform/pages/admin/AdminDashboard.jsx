import { Routes, Route, Navigate } from 'react-router-dom'
import PageLayout from '../../components/layout/PageLayout.jsx'
import AdminHomeTab from './AdminHomeTab.jsx'
import StatisticsTab from './StatisticsTab.jsx'
import UserManagementTab from './UserManagementTab.jsx'

const TABS = [
  { path: '/admin/home', label: '홈', icon: '🏠' },
  { path: '/admin/statistics', label: '통계', icon: '📊' },
  { path: '/admin/users', label: '사용자', icon: '👥' },
]

export default function AdminDashboard() {
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
