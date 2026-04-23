import { useNavigate } from 'react-router-dom'
import { GraduationCap, ChevronRight, User, BookOpen, Settings, Users, Briefcase, Monitor } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const ACTIVE_ROLES = [
  { role: 'student', label: '학생', icon: BookOpen, color: 'bg-blue-500 hover:bg-blue-600', desc: '학습 현황 · 마인드 · 진로' },
  { role: 'manager', label: '학습매니저', icon: Users, color: 'bg-emerald-500 hover:bg-emerald-600', desc: '학생 관리 · 코칭 · 알림' },
  { role: 'admin', label: '관리자', icon: Settings, color: 'bg-violet-500 hover:bg-violet-600', desc: '통계 · 사용자 관리 · 리포트' },
]

const UPCOMING_ROLES = [
  { role: 'parent', label: '학부모', icon: User, desc: '준비 중' },
  { role: 'teacher', label: '강사', icon: Monitor, desc: '준비 중' },
  { role: 'consultant', label: '컨설턴트', icon: Briefcase, desc: '준비 중' },
]

const ROLE_PATHS = {
  student: '/student',
  manager: '/manager',
  admin: '/admin',
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = (role) => {
    login(role)
    navigate(ROLE_PATHS[role])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4 shadow-lg">
            <GraduationCap size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">안동형 자기주도학습</h1>
          <p className="text-sm text-gray-500 mt-1">진로성장 관리 시스템</p>
          <span className="inline-block mt-3 px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
            시연용 프로토타입
          </span>
        </div>

        {/* 활성 역할 */}
        <div className="space-y-3 mb-6">
          {ACTIVE_ROLES.map(({ role, label, icon: Icon, color, desc }) => (
            <button
              key={role}
              onClick={() => handleLogin(role)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-white font-semibold shadow-md transition-all active:scale-95 ${color}`}
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon size={22} />
              </div>
              <div className="text-left">
                <div className="text-base">{label}으로 시작</div>
                <div className="text-xs opacity-80">{desc}</div>
              </div>
              <ChevronRight size={20} className="ml-auto opacity-80" />
            </button>
          ))}
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">향후 지원 예정</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* 준비 중 역할 */}
        <div className="grid grid-cols-3 gap-2">
          {UPCOMING_ROLES.map(({ role, label, icon: Icon, desc }) => (
            <div
              key={role}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-white border border-gray-200 opacity-50 cursor-not-allowed"
            >
              <Icon size={20} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-600">{label}</span>
              <span className="text-xs text-gray-400">{desc}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          안동시 교육지원청 · 2026
        </p>
      </div>
    </div>
  )
}
