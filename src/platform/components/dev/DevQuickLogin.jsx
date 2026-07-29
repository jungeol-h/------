// 개발 전용 빠른 로그인 — 테스트 캐스트(scripts/seed-test-cast.sql) 원클릭 진입.
// import.meta.env.DEV(로컬 vite dev)에서만 렌더되고 프로덕션 번들에서는 제거된다.
// 비밀번호는 .env의 VITE_TEST_PASSWORD — 미설정이면 패널 자체를 숨긴다.

import { useAuth } from '../../context/AuthContext.jsx'

const CAST = [
  { loginId: '테스트관리자', label: '관리자' },
  { loginId: '테스트매니저', label: '매니저' },
  { loginId: '테스트강사', label: '강사' },
  { loginId: '테스트컨설턴트', label: '컨설턴트' },
  { loginId: '테스트열람자', label: '열람자' },
  { loginId: '테스트학부모', label: '학부모' },
  { loginId: '황준걸중1', label: '학생 중1' },
  { loginId: '황준걸중2', label: '학생 중2' },
  { loginId: '황준걸중3', label: '학생 중3' },
]

export default function DevQuickLogin() {
  const { login, loading } = useAuth()
  const testPassword = import.meta.env.VITE_TEST_PASSWORD
  if (!testPassword) return null

  return (
    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
      <p className="text-[11px] font-semibold text-amber-700 mb-2">
        DEV 빠른 로그인 — 테스트 캐스트 (프로덕션에는 없음)
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {CAST.map(({ loginId, label }) => (
          <button
            key={loginId}
            type="button"
            disabled={loading}
            onClick={() => login(loginId, testPassword)}
            className="py-2 px-1 rounded-lg bg-white border border-amber-200 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-40 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
