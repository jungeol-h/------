import { useNavigate } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
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
    <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-lg mx-auto flex items-center px-4 h-14 gap-3">
        <span className={`text-xs text-white font-bold px-2 py-1 rounded-full flex-shrink-0 ${ROLE_COLORS[currentUser?.role] || 'bg-gray-400'}`}>
          {ROLE_LABELS[currentUser?.role] || ''}
        </span>
        <h1 className="flex-1 font-bold text-gray-900 text-base truncate">
          {title || '안동형 자기주도학습'}
        </h1>
        {badge > 0 && (
          <div className="relative flex-shrink-0">
            <Bell size={20} className="text-red-500" />
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {badge}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5 flex-shrink-0"
        >
          <LogOut size={13} />
          <span>전환</span>
        </button>
      </div>
    </header>
  )
}
