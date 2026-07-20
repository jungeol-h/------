// 학생 라우트 셸 (/student/*) — 진단 탭 하위에 학습진단/진로설계/확인평가.
// DataContext 로딩 가드 후 PageLayout + Routes 구성.
// [임시] 타이머 버그 안내 모달(TimerFixNoticeModal)을 학생별 1회 노출 — 철수 시 제거.

import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Home, BookOpen, ClipboardList, Heart, Activity, CalendarClock, Loader } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { TIMER_FIX_NOTICE, noticeStorageKey } from './tempBetaNotice.js'
import DashboardTab from './DashboardTab.jsx'
import LearningTab from './LearningTab.jsx'
import TaskTab from './TaskTab.jsx'
import MindTab from './MindTab.jsx'
import DiagnosisIndexTab from './DiagnosisIndexTab.jsx'
import CareerDesignTab from './CareerDesignTab.jsx'
import LearningDiagnosisTab from './LearningDiagnosisTab.jsx'
import QuizTab from './QuizTab.jsx'
import BookingTab from './BookingTab.jsx'

const TABS = [
  { path: '/student/dashboard', label: '홈', icon: Home },
  { path: '/student/learning', label: '학습', icon: BookOpen },
  { path: '/student/task', label: '과제', icon: ClipboardList },
  { path: '/student/booking', label: '예약', icon: CalendarClock },
  { path: '/student/mind', label: '마인드', icon: Heart },
  { path: '/student/diagnosis', label: '진단', icon: Activity },
]

// [임시] 타이머 버그 사과·안내 모달. 학생별로 한 번만 노출. 철수 시 제거.
function TimerFixNoticeModal() {
  const { currentUser } = useAuth()
  const [open, setOpen] = useState(() => {
    if (!currentUser?.id) return false
    try {
      return !localStorage.getItem(noticeStorageKey(currentUser.id))
    } catch {
      return false
    }
  })

  if (!open) return null

  const dismiss = () => {
    try {
      localStorage.setItem(noticeStorageKey(currentUser.id), '1')
    } catch {
      // 무시
    }
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-gray-900">{TIMER_FIX_NOTICE.title}</h2>
        <div className="space-y-2">
          {TIMER_FIX_NOTICE.body.map((line, index) => (
            <p key={index} className="text-sm leading-relaxed text-gray-600">{line}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-95"
        >
          확인했어요
        </button>
      </div>
    </div>
  )
}

export default function StudentDashboard() {
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
    <PageLayout title="나의 학습" tabs={TABS}>
      <TimerFixNoticeModal />
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardTab />} />
        <Route path="learning" element={<LearningTab />} />
        <Route path="task" element={<TaskTab />} />
        <Route path="booking" element={<BookingTab />} />
        <Route path="mind" element={<MindTab />} />
        <Route path="diagnosis" element={<DiagnosisIndexTab />} />
        <Route path="diagnosis/learning" element={<LearningDiagnosisTab />} />
        <Route path="diagnosis/career" element={<CareerDesignTab />} />
        <Route path="diagnosis/quiz" element={<QuizTab />} />
      </Routes>
    </PageLayout>
  )
}
