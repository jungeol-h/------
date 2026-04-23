import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const ROLE_LABELS = {
  student: '학생',
  manager: '학습매니저',
  admin: '관리자',
}

const ROLE_COLORS = {
  student: 'bg-blue-500',
  manager: 'bg-emerald-500',
  admin: 'bg-violet-500',
}

export default function Header({ title, badge }) {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-lg mx-auto flex items-center px-4 h-14">
        {/* 역할 배지 */}
        <span className={`text-xs text-white font-bold px-2 py-1 rounded-full mr-2 ${ROLE_COLORS[currentUser?.role] || 'bg-gray-400'}`}>
          {ROLE_LABELS[currentUser?.role] || ''}
        </span>
        {/* 타이틀 */}
        <h1 className="flex-1 font-bold text-gray-900 text-base truncate">
          {title || '안동형 자기주도학습'}
        </h1>
        {/* 알림 배지 */}
        {badge > 0 && (
          <span className="mr-3 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
            🚨 {badge}
          </span>
        )}
        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1"
        >
          전환
        </button>
      </div>
    </header>
  )
}
