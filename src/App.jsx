import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './platform/context/AuthContext.jsx'
import { DataProvider } from './platform/context/DataContext.jsx'
import LoginPage from './platform/pages/LoginPage.jsx'
import StudentDashboard from './platform/pages/student/StudentDashboard.jsx'
import ManagerDashboard from './platform/pages/manager/ManagerDashboard.jsx'
import AdminDashboard from './platform/pages/admin/AdminDashboard.jsx'
import ProtectedRoute from './platform/components/layout/ProtectedRoute.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
