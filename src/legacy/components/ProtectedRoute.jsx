import { Navigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'

export default function ProtectedRoute({ condition, redirectTo, children }) {
  const { state } = useDiagnosis()
  if (!condition(state)) return <Navigate to={redirectTo} replace />
  return children
}
