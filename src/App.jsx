import { Routes, Route, Navigate } from 'react-router-dom'
import { DiagnosisProvider } from './context/DiagnosisContext'
import IntroPage from './pages/IntroPage'
import SurveyPage from './pages/SurveyPage'
import ResultPage from './pages/ResultPage'

export default function App() {
  return (
    <DiagnosisProvider>
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DiagnosisProvider>
  )
}
