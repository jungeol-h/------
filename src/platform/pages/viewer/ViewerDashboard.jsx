// 열람자(viewer, 본부장·공무원) 라우트 셸 (/viewer/*) — 관리자와 같은 7탭 열람 (2026-07 클라이언트 요청).
// 관리자 화면 재사용 + readOnly로 쓰기 액션만 숨김. 보고서(PDF·엑셀) 출력은 허용.
// 예약 탭은 AdminBookingView 전체가 아니라 예약현황 조회(ReservationSearch)만 노출.
// 데이터 범위: fetchForAdmin 그룹 스코프 — viewer 계정 group_names가 비어 있으면 전체 열람.
// 학생 상세는 /viewer/student/:studentId.

import { Routes, Route, Navigate } from 'react-router-dom'
import {
  Home, UserCog, MessageSquare, ClipboardCheck, Globe,
  CalendarCheck, CalendarClock, Loader,
} from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useData } from '../../context/DataContext.jsx'
import AdminHomeTab from '../admin/AdminHomeTab.jsx'
import UserManagementTab from '../admin/UserManagementTab.jsx'
import QuizMonitorTab from '../admin/QuizMonitorTab.jsx'
import WorkRecordsTab from '../shared/WorkRecordsTab.jsx'
import StudentDetailPage from '../shared/StudentDetailPage.jsx'
import AttendanceTab from '../manager/AttendanceTab.jsx'
import ExternalCounselingTab from '../educator/external/ExternalCounselingTab.jsx'
import { BookingProvider } from '../../booking/BookingContext.jsx'
import BookingGate from '../../booking/components/BookingGate.jsx'
import ReservationSearch from '../../booking/components/ReservationSearch.jsx'

const TABS = [
  { path: '/viewer/home', label: '홈', icon: Home },
  { path: '/viewer/attendance', label: '출결', icon: CalendarCheck },
  { path: '/viewer/students', label: '학생', icon: UserCog },
  { path: '/viewer/booking', label: '예약', icon: CalendarClock },
  { path: '/viewer/counseling', label: '업무기록', icon: MessageSquare },
  { path: '/viewer/quiz', label: '확인평가', icon: ClipboardCheck },
  { path: '/viewer/external', label: '외부상담', icon: Globe },
]

function StudentDetailWrapper({ tabs, back }) {
  return (
    <PageLayout title="학생 정보" back={back} tabs={tabs}>
      <StudentDetailPage />
    </PageLayout>
  )
}

// 예약현황 조회 전용 — 슬롯 생성·프로그램 설정 등 관리 메뉴 없이 검색+엑셀만
function ViewerBookingTab() {
  return (
    <BookingProvider>
      <BookingGate>
        <div className="py-4">
          <ReservationSearch readOnly />
        </div>
      </BookingGate>
    </BookingProvider>
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
      {/* 학생 탭 — 목록이 min-w-[760px]라 데스크톱에선 wide 풀폭으로 (관리자 학생 탭과 동일) */}
      <Route path="students" element={
        <PageLayout title="열람자" tabs={TABS} wide>
          <UserManagementTab readOnly />
        </PageLayout>
      } />
      {/* 출결 탭 — LMS식 명단 테이블·타임라인이라 데스크톱 풀폭 (관리자와 동일) */}
      <Route path="attendance" element={
        <PageLayout title="열람자" tabs={TABS} wide>
          <AttendanceTab />
        </PageLayout>
      } />
      <Route path="quiz" element={
        <PageLayout title="열람자" tabs={TABS} wide>
          <QuizMonitorTab readOnly />
        </PageLayout>
      } />
      <Route path="*" element={
        <PageLayout title="열람자" tabs={TABS}>
          <Routes>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<AdminHomeTab basePath="/viewer" readOnly />} />
            {/* 구 통계 탭 경로 — 홈 하단 통계로 통합 */}
            <Route path="stats" element={<Navigate to="/viewer/home" replace />} />
            <Route path="booking" element={<ViewerBookingTab />} />
            <Route path="counseling" element={<WorkRecordsTab />} />
            <Route path="external" element={<ExternalCounselingTab />} />
          </Routes>
        </PageLayout>
      } />
    </Routes>
  )
}
