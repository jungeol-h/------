// 교과강사(instructor)·컨설턴트(consultant) 공용 라우트 셸 (/instructor/*, /consultant/*).
// 공통 탭: 학생·업무기록·과제 + instructor 전용 확인평가(wide) + consultant 전용 외부상담.
// 학생 상세는 /{role}/student/:studentId. 타이틀·경로는 currentUser.role로 분기.

import { Routes, Route, Navigate } from 'react-router-dom'
import { Users, MessageSquare, ClipboardList, ClipboardCheck, Globe, Loader } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import EducatorStudentListTab from './EducatorStudentListTab.jsx'
import WorkRecordsTab from '../shared/WorkRecordsTab.jsx'
import EducatorTaskTab from './EducatorTaskTab.jsx'
import ExternalCounselingTab from './external/ExternalCounselingTab.jsx'
import QuizMonitorTab from '../admin/QuizMonitorTab.jsx'
import StudentDetailPage from '../shared/StudentDetailPage.jsx'

const ROLE_TITLES = { instructor: '교과강사', consultant: '컨설턴트' }

function StudentDetailWrapper({ tabs, back }) {
  return (
    <PageLayout title="학생 정보" back={back} tabs={tabs}>
      <StudentDetailPage />
    </PageLayout>
  )
}

export default function EducatorDashboard() {
  const { currentUser } = useAuth()
  const { loading } = useData()
  const role = currentUser?.role
  const basePath = `/${role}`
  const title = ROLE_TITLES[role] || '교육자'
  const isInstructor = role === 'instructor'
  const isConsultant = role === 'consultant'

  // 공통 탭 + instructor 전용 확인평가 탭 + consultant 전용 외부상담 탭.
  const tabs = [
    { path: `${basePath}/students`, label: '학생', icon: Users },
    { path: `${basePath}/counseling`, label: '업무기록', icon: MessageSquare },
    { path: `${basePath}/tasks`, label: '과제', icon: ClipboardList },
    ...(isInstructor
      ? [{ path: `${basePath}/quiz`, label: '확인평가', icon: ClipboardCheck }]
      : []),
    ...(isConsultant
      ? [{ path: `${basePath}/external`, label: '외부상담', icon: Globe }]
      : []),
  ]

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
        <StudentDetailWrapper tabs={tabs} back={`${basePath}/students`} />
      } />
      {isInstructor && (
        <Route path="quiz" element={
          <PageLayout title={title} tabs={tabs} wide>
            <QuizMonitorTab />
          </PageLayout>
        } />
      )}
      <Route path="*" element={
        <PageLayout title={title} tabs={tabs}>
          <Routes>
            <Route index element={<Navigate to="students" replace />} />
            <Route path="students" element={<EducatorStudentListTab />} />
            <Route path="counseling" element={<WorkRecordsTab />} />
            <Route path="tasks" element={<EducatorTaskTab />} />
            {isConsultant && (
              <Route path="external" element={<ExternalCounselingTab />} />
            )}
          </Routes>
        </PageLayout>
      } />
    </Routes>
  )
}
