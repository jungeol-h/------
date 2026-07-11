import { Routes, Route, Navigate } from 'react-router-dom'
import { Home, UserCog, MessageSquare, ClipboardCheck, Globe, Loader } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useData } from '../../context/DataContext.jsx'
import AdminHomeTab from './AdminHomeTab.jsx'
import UserManagementTab from './UserManagementTab.jsx'
import WorkRecordsTab from '../shared/WorkRecordsTab.jsx'
import QuizMonitorTab from './QuizMonitorTab.jsx'
import ExternalCounselingTab from '../educator/external/ExternalCounselingTab.jsx'
import StudentDetailPage from '../shared/StudentDetailPage.jsx'

// '업무계획'+'업무보고' 탭은 '업무기록' 통합 탭(5메뉴)으로 합쳐짐 (2026-07 클라이언트 요청)
const TABS = [
  { path: '/admin/home', label: '홈', icon: Home },
  { path: '/admin/users', label: '학생', icon: UserCog },
  { path: '/admin/counseling', label: '업무기록', icon: MessageSquare },
  { path: '/admin/quiz', label: '확인평가', icon: ClipboardCheck },
  { path: '/admin/external', label: '외부상담', icon: Globe },
]

function StudentDetailWrapper({ tabs, back }) {
  return (
    <PageLayout title="학생 정보" back={back} tabs={tabs}>
      <StudentDetailPage />
    </PageLayout>
  )
}

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
    <Routes>
      <Route path="student/:studentId" element={
        <StudentDetailWrapper tabs={TABS} back="/admin/users" />
      } />
      <Route path="quiz" element={
        <PageLayout title="관리자" tabs={TABS} wide>
          <QuizMonitorTab />
        </PageLayout>
      } />
      <Route path="*" element={
        <PageLayout title="관리자" tabs={TABS}>
          <Routes>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<AdminHomeTab />} />
            <Route path="statistics" element={<Navigate to="/admin/home" replace />} />
            <Route path="plans" element={<Navigate to="/admin/counseling?menu=plans" replace />} />
            <Route path="users" element={<UserManagementTab />} />
            <Route path="counseling" element={<WorkRecordsTab />} />
            <Route path="external" element={<ExternalCounselingTab />} />
          </Routes>
        </PageLayout>
      } />
    </Routes>
  )
}
