import { Routes, Route, Navigate } from 'react-router-dom'
import { Home, Users, MessageSquare, ClipboardCheck, Loader } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { getRiskStudents } from '../../context/selectors/riskDetection.js'
import ManagerHomeTab from './ManagerHomeTab.jsx'
import StudentListTab from './StudentListTab.jsx'
import CounselingTab from './CounselingTab.jsx'
import QuizMonitorTab from './QuizMonitorTab.jsx'
import StudentDetailPage from '../shared/StudentDetailPage.jsx'

const TABS = [
  { path: '/manager/home', label: '홈', icon: Home },
  { path: '/manager/students', label: '학생', icon: Users },
  { path: '/manager/counseling', label: '상담', icon: MessageSquare },
  { path: '/manager/quiz', label: '확인평가', icon: ClipboardCheck },
]

function StudentDetailWrapper({ tabs, back }) {
  return (
    <PageLayout title="학생 정보" back={back} tabs={tabs}>
      <StudentDetailPage />
    </PageLayout>
  )
}

export default function ManagerDashboard() {
  const { currentUser } = useAuth()
  const { data, loading } = useData()
  // 탭 badge — 담당 학생 중 마인드 위험 학생 수
  const unresolved = getRiskStudents(data, { educatorId: currentUser?.id }).length

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
            <Route path="quiz" element={<QuizMonitorTab />} />
          </Routes>
        </PageLayout>
      } />
    </Routes>
  )
}
