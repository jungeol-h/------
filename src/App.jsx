import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './platform/context/AuthContext.jsx'
import { DataProvider } from './platform/context/DataContext.jsx'
import { FeedbackProvider } from './platform/components/FeedbackProvider.jsx'
import { ToastProvider } from './platform/components/common/ToastProvider.jsx'
import LoginPage from './platform/pages/LoginPage.jsx'
import StudentDashboard from './platform/pages/student/StudentDashboard.jsx'
import ManagerDashboard from './platform/pages/manager/ManagerDashboard.jsx'
import AdminDashboard from './platform/pages/admin/AdminDashboard.jsx'
import EducatorDashboard from './platform/pages/educator/EducatorDashboard.jsx'
import ViewerDashboard from './platform/pages/viewer/ViewerDashboard.jsx'
import ParentDashboard from './platform/pages/parent/ParentDashboard.jsx'
import ProtectedRoute from './platform/components/layout/ProtectedRoute.jsx'
import InstallGuidePage from './platform/pages/InstallGuidePage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <FeedbackProvider>
            <ToastProvider>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route
                path="/student/*"
                element={
                  <ProtectedRoute role="student">
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/*"
                element={
                  <ProtectedRoute role="manager">
                    <ManagerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute role="admin">
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/*"
                element={
                  <ProtectedRoute role="instructor">
                    <EducatorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consultant/*"
                element={
                  <ProtectedRoute role="consultant">
                    <EducatorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/viewer/*"
                element={
                  <ProtectedRoute role="viewer">
                    <ViewerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/parent/*"
                element={
                  <ProtectedRoute role="parent">
                    <ParentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/install-guide" element={<InstallGuidePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </ToastProvider>
          </FeedbackProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
