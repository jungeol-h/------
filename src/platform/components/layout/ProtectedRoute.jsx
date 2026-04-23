import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function ProtectedRoute({ role, children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/" replace />
  if (currentUser.role !== role) return <Navigate to={`/${currentUser.role}`} replace />
  return children
}
