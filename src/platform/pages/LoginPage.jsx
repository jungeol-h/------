import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Eye, EyeOff, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

const ROLE_PATHS = {
  student: '/student',
  manager: '/manager',
  admin: '/admin',
}

export default function LoginPage() {
  const { login, loading, error } = useAuth()
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!loginId.trim() || !password.trim()) return
    const success = await login(loginId, password)
    if (success) {
      // role은 login 후 currentUser에서 확인 — 잠시 후 AuthContext state 반영
      // navigate는 currentUser 변경 후 ProtectedRoute가 처리하지만,
      // 여기서 role별 경로로 바로 이동
      const saved = localStorage.getItem('platform_user')
      if (saved) {
        const user = JSON.parse(saved)
        navigate(ROLE_PATHS[user.role] ?? '/')
      }
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
          <h1 className="text-2xl font-bold text-gray-900">산청 우정학사</h1>
          <p className="text-sm text-gray-500 mt-1">자기주도학습 관리 시스템</p>
        </div>

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

        {/* 안내 */}
        <div className="mt-5 px-4 py-3 bg-white/60 rounded-xl text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-600">로그인 안내</p>
          <p>• 학생 초기 비밀번호: 생년월일 8자리 (예: 20100315)</p>
          <p>• 비밀번호를 모를 경우 담당 선생님에게 문의하세요</p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          산청 우정학사 · 2026
        </p>
      </div>
    </div>
  )
}
