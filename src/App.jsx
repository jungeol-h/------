import { Routes, Route, Navigate } from 'react-router-dom'
import { DiagnosisProvider } from './context/DiagnosisContext'
import ProtectedRoute from './components/ProtectedRoute'
import IntroPage from './pages/IntroPage'
import PersonalInfoPage from './pages/PersonalInfoPage'
import PreSurveyPage from './pages/PreSurveyPage'
import SurveyPage from './pages/SurveyPage'
import ResultPage from './pages/ResultPage'

export default function App() {
  return (
    <DiagnosisProvider>
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/info" element={<PersonalInfoPage />} />

        <Route
          path="/pre-survey"
          element={
            <ProtectedRoute condition={s => s.studentName !== ''} redirectTo="/info">
              <PreSurveyPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/survey"
          element={
            <ProtectedRoute condition={s => s.studentName !== ''} redirectTo="/info">
              <SurveyPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/result"
          element={
            <ProtectedRoute condition={s => s.isCompleted && s.result !== null} redirectTo="/survey">
              <ResultPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DiagnosisProvider>
  )
}
