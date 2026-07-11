// 열람자(viewer, 본부장·공무원) 라우트 셸 (/viewer/*) — 3탭: 통계·학생·업무기록, 전부 열람 전용.
// 관리자 화면 재사용: StatisticsTab, UserManagementTab(readOnly), 공용 WorkRecordsTab.
// 학생 상세는 /viewer/student/:studentId.

import { Routes, Route, Navigate } from 'react-router-dom'
import { BarChart2, Users, MessageSquare, Loader } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useData } from '../../context/DataContext.jsx'
import StatisticsTab from '../admin/StatisticsTab.jsx'
import UserManagementTab from '../admin/UserManagementTab.jsx'
import WorkRecordsTab from '../shared/WorkRecordsTab.jsx'
import StudentDetailPage from '../shared/StudentDetailPage.jsx'

const TABS = [
  { path: '/viewer/stats', label: '통계', icon: BarChart2 },
  { path: '/viewer/students', label: '학생', icon: Users },
  { path: '/viewer/counseling', label: '업무기록', icon: MessageSquare },
]

function StudentDetailWrapper({ tabs, back }) {
  return (
    <PageLayout title="학생 정보" back={back} tabs={tabs}>
      <StudentDetailPage />
    </PageLayout>
  )
}

export default function ViewerDashboard() {
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
        <StudentDetailWrapper tabs={TABS} back="/viewer/students" />
      } />
      <Route path="*" element={
        <PageLayout title="열람자" tabs={TABS}>
          <Routes>
            <Route index element={<Navigate to="stats" replace />} />
            <Route path="stats" element={<StatisticsTab />} />
            <Route path="students" element={<UserManagementTab readOnly />} />
            <Route path="counseling" element={<WorkRecordsTab />} />
          </Routes>
        </PageLayout>
      } />
    </Routes>
  )
}
