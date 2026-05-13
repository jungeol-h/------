import { Routes, Route, Navigate } from 'react-router-dom'
import { Home, BookOpen, ClipboardList, Heart, Activity, Loader } from 'lucide-react'
import PageLayout from '../../components/layout/PageLayout.jsx'
import { useData } from '../../context/DataContext.jsx'
import DashboardTab from './DashboardTab.jsx'
import LearningTab from './LearningTab.jsx'
import TaskTab from './TaskTab.jsx'
import MindTab from './MindTab.jsx'
import DiagnosisIndexTab from './DiagnosisIndexTab.jsx'
import CareerDesignTab from './CareerDesignTab.jsx'
import LearningDiagnosisTab from './LearningDiagnosisTab.jsx'
import QuizTab from './QuizTab.jsx'

const TABS = [
  { path: '/student/dashboard', label: '홈', icon: Home },
  { path: '/student/learning', label: '학습', icon: BookOpen },
  { path: '/student/task', label: '과제', icon: ClipboardList },
  { path: '/student/mind', label: '마인드', icon: Heart },
  { path: '/student/diagnosis', label: '진단', icon: Activity },
]

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
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardTab />} />
        <Route path="learning" element={<LearningTab />} />
        <Route path="task" element={<TaskTab />} />
        <Route path="mind" element={<MindTab />} />
        <Route path="diagnosis" element={<DiagnosisIndexTab />} />
        <Route path="diagnosis/learning" element={<LearningDiagnosisTab />} />
        <Route path="diagnosis/career" element={<CareerDesignTab />} />
        <Route path="diagnosis/quiz" element={<QuizTab />} />
      </Routes>
    </PageLayout>
  )
}
