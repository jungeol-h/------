import { Routes, Route, Navigate } from 'react-router-dom'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import ManagerHomeTab from './ManagerHomeTab.jsx'
import StudentListTab from './StudentListTab.jsx'
import CounselingTab from './CounselingTab.jsx'

const TABS = [
  { path: '/manager/home', label: '홈', icon: '🏠' },
  { path: '/manager/students', label: '학생', icon: '👥' },
  { path: '/manager/counseling', label: '상담', icon: '💬' },
]

export default function ManagerDashboard() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const unresolved = data.alerts.filter(a => a.managerId === currentUser?.id && !a.resolved).length

  return (
    <PageLayout title="학습매니저" badge={unresolved} tabs={TABS}>
      <Routes>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<ManagerHomeTab />} />
        <Route path="students" element={<StudentListTab />} />
        <Route path="counseling" element={<CounselingTab />} />
      </Routes>
    </PageLayout>
  )
}
