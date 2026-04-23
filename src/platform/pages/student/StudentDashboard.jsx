import { Routes, Route, Navigate } from 'react-router-dom'
import PageLayout from '../../components/layout/PageLayout.jsx'
import DashboardTab from './DashboardTab.jsx'
import LearningTab from './LearningTab.jsx'
import TaskTab from './TaskTab.jsx'
import MindTab from './MindTab.jsx'
import CareerTab from './CareerTab.jsx'

const TABS = [
  { path: '/student/dashboard', label: '홈', icon: '🏠' },
  { path: '/student/learning', label: '학습', icon: '📖' },
  { path: '/student/task', label: '과제', icon: '✅' },
  { path: '/student/mind', label: '마인드', icon: '💚' },
  { path: '/student/career', label: '진로', icon: '🎯' },
]

export default function StudentDashboard() {
  return (
    <PageLayout title="나의 학습" tabs={TABS}>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardTab />} />
        <Route path="learning" element={<LearningTab />} />
        <Route path="task" element={<TaskTab />} />
        <Route path="mind" element={<MindTab />} />
        <Route path="career" element={<CareerTab />} />
      </Routes>
    </PageLayout>
  )
}
