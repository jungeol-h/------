import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Home, Users, MessageSquare, Loader } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import ManagerHomeTab from './ManagerHomeTab.jsx'
import StudentListTab from './StudentListTab.jsx'
import CounselingTab from './CounselingTab.jsx'
import StudentDetailPage from '../shared/StudentDetailPage.jsx'

const TABS = [
  { path: '/manager/home', label: '홈', icon: Home },
  { path: '/manager/students', label: '학생', icon: Users },
  { path: '/manager/counseling', label: '상담', icon: MessageSquare },
]

function StudentDetailWrapper({ tabs, back }) {
  const { studentId } = useParams()
  const { data } = useData()
  const student = data.students.find(s => s.id === studentId)
  return (
    <PageLayout title={student?.name ?? '학생 정보'} back={back} tabs={tabs}>
      <StudentDetailPage />
    </PageLayout>
  )
}

export default function ManagerDashboard() {
  const { currentUser } = useAuth()
  const { data, loading } = useData()
  const unresolved = data.alerts.filter((a) => a.managerId === currentUser?.id && !a.resolved).length

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
    <Routes>
      <Route path="student/:studentId" element={
        <StudentDetailWrapper tabs={TABS} back="/manager/students" />
      } />
      <Route path="*" element={
        <PageLayout title="학습매니저" badge={unresolved} tabs={TABS}>
          <Routes>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<ManagerHomeTab />} />
            <Route path="students" element={<StudentListTab />} />
            <Route path="counseling" element={<CounselingTab />} />
          </Routes>
        </PageLayout>
      } />
    </Routes>
  )
}
