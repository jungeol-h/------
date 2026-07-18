// 관리자(센터장) 라우트 셸 (/admin/*) — 6탭: 홈·출결·학생·업무기록·확인평가·외부상담.
// 확인평가는 wide 레이아웃 별도 라우트, 학생 상세는 /admin/student/:studentId.
// 구 통계(/admin/statistics)·업무계획(/admin/plans) 경로는 홈·업무기록 탭으로 리다이렉트.
// 출결 탭·키오스크는 매니저 화면 재사용 — 관리자는 전체 학생 대상 (2026-07 클라이언트 요청).

import { Routes, Route, Navigate } from 'react-router-dom'
import { Home, UserCog, MessageSquare, ClipboardCheck, Globe, CalendarCheck, CalendarClock, Loader } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useData } from '../../context/DataContext.jsx'
import AdminHomeTab from './AdminHomeTab.jsx'
import UserManagementTab from './UserManagementTab.jsx'
import WorkRecordsTab from '../shared/WorkRecordsTab.jsx'
import QuizMonitorTab from './QuizMonitorTab.jsx'
import ExternalCounselingTab from '../educator/external/ExternalCounselingTab.jsx'
import StudentDetailPage from '../shared/StudentDetailPage.jsx'
import KioskPage from '../manager/KioskPage.jsx'
import AttendanceTab from '../manager/AttendanceTab.jsx'
import AdminBookingTab from './AdminBookingTab.jsx'

// '업무계획'+'업무보고' 탭은 '업무기록' 통합 탭(5메뉴)으로 합쳐짐 (2026-07 클라이언트 요청)
// '예약' 탭은 컨설팅·코칭 예약 시스템 — 내부 5메뉴(운영현황·예약현황·타임테이블·프로그램·이력)
const TABS = [
  { path: '/admin/home', label: '홈', icon: Home },
  { path: '/admin/attendance', label: '출결', icon: CalendarCheck },
  { path: '/admin/users', label: '학생', icon: UserCog },
  { path: '/admin/booking', label: '예약', icon: CalendarClock },
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
      {/* 키오스크 — 센터 공용 태블릿용 전체화면 (Header/TabBar 없음). 매니저와 동일 화면 */}
      <Route path="kiosk" element={<KioskPage />} />
      <Route path="quiz" element={
        <PageLayout title="관리자" tabs={TABS} wide>
          <QuizMonitorTab />
        </PageLayout>
      } />
      {/* 학생 탭 — 목록이 min-w-[760px]라 데스크톱에선 wide 풀폭으로 */}
      <Route path="users" element={
        <PageLayout title="관리자" tabs={TABS} wide>
          <UserManagementTab />
        </PageLayout>
      } />
      <Route path="*" element={
        <PageLayout title="관리자" tabs={TABS}>
          <Routes>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<AdminHomeTab />} />
            <Route path="attendance" element={<AttendanceTab />} />
            <Route path="statistics" element={<Navigate to="/admin/home" replace />} />
            <Route path="plans" element={<Navigate to="/admin/counseling?menu=plans" replace />} />
            <Route path="booking" element={<AdminBookingTab />} />
            <Route path="counseling" element={<WorkRecordsTab />} />
            <Route path="external" element={<ExternalCounselingTab />} />
          </Routes>
        </PageLayout>
      } />
    </Routes>
  )
}
