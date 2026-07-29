// 로그인 화면 (라우트 '/') — 학번/아이디 + 비밀번호로 AuthContext.login 호출 후
// 역할별 홈(ROLE_PATHS)으로 이동. 이미 로그인 상태면 자동 리다이렉트.
// 상단에 PWA 설치 가이드(/install-guide) 배너 포함.

import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { GraduationCap, Eye, EyeOff, Loader, Download } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import DevQuickLogin from '../components/dev/DevQuickLogin.jsx'

const ROLE_PATHS = {
  student: '/student',
  manager: '/manager',
  admin: '/admin',
  instructor: '/instructor',
  consultant: '/consultant',
  viewer: '/viewer',
  parent: '/parent',
}

export default function LoginPage() {
  const { currentUser, login, loading, error } = useAuth()
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    if (currentUser) {
      navigate(ROLE_PATHS[currentUser.role] ?? '/', { replace: true })
    }
  }, [currentUser, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!loginId.trim() || !password.trim()) return
    const user = await login(loginId, password)
    if (user) {
      navigate(ROLE_PATHS[user.role] ?? '/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4 shadow-lg">
            <GraduationCap size={36} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">나매크</h1>
        </div>

        {/* 앱 설치 배너 */}
        <Link
          to="/install-guide"
          className="flex items-center gap-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl px-4 py-3 mb-4 shadow-md transition-colors"
        >
          <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
            <Download size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">앱으로 설치하기</p>
            <p className="text-violet-200 text-xs mt-0.5">홈 화면에 추가해서 앱처럼 사용하세요</p>
          </div>
          <span className="text-violet-300 text-lg leading-none">›</span>
        </Link>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg px-6 py-7 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">학번 또는 아이디</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="예: 2026101"
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !loginId.trim() || !password.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold text-sm transition-colors"
          >
            {loading ? <Loader size={18} className="animate-spin" /> : null}
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 개발 전용 — 프로덕션 빌드에서는 코드째 제거된다 */}
        {import.meta.env.DEV && <DevQuickLogin />}

        {/* 안내 */}
        <div className="mt-5 px-4 py-3 bg-white/60 rounded-xl text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-600">로그인 안내</p>
          <p>• 초기 비밀번호: 본인 전화번호 (첫 로그인 때 새 비밀번호를 정합니다)</p>
          <p>• 비밀번호를 잊었다면 담당 선생님에게 초기화를 요청하세요</p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          나매크 · 2026
        </p>
      </div>
    </div>
  )
}
