import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import ForcePasswordResetModal from '../auth/ForcePasswordResetModal.jsx'

export default function ProtectedRoute({ role, children }) {
  const { currentUser, mustChangePassword } = useAuth()
  const location = useLocation()
  if (!currentUser) return <Navigate to="/" replace />
  const allowed = Array.isArray(role) ? role : [role]
  if (!allowed.includes(currentUser.role)) return <Navigate to={`/${currentUser.role}`} replace />
  // 비밀번호를 본인이 정한 적 없는 계정은 재설정 모달로 덮는다.
  // 키오스크(공용 기기, 매니저 계정 상주)는 제외 — 개인 기기에서 로그인할 때 처리.
  const isKiosk = location.pathname.startsWith('/manager/kiosk')
  return (
    <>
      {children}
      {mustChangePassword && !isKiosk && <ForcePasswordResetModal />}
    </>
  )
}
