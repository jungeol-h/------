// 첫 로그인(또는 비밀번호 초기화 후) 강제 재설정 모달 — 닫기 불가.
// ProtectedRoute가 mustChangePassword일 때 화면 위에 덮는다.
// 본인 증명은 직전 로그인으로 끝났으므로 현재 비밀번호 확인은 받지 않는다.

import { useState } from 'react'
import { KeyRound, Loader } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { validateNewPassword, PASSWORD_MIN_LENGTH } from '../../lib/passwords.js'

export default function ForcePasswordResetModal() {
  const { currentUser, completeForcedReset, logout } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const canSave = !saving && pw && pw2

  const handleSave = async () => {
    setErrorMsg('')
    // 초기 비밀번호(=본인/학부모 연락처)로 되돌려 쓰는 것 방지
    const invalid = validateNewPassword(pw, {
      forbidden: [currentUser?.phone, currentUser?.parentPhone],
    })
    if (invalid) {
      setErrorMsg(invalid)
      return
    }
    if (pw !== pw2) {
      setErrorMsg('비밀번호가 서로 다릅니다. 같은 값을 두 번 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await completeForcedReset(pw)
    } catch (err) {
      setErrorMsg(err?.message ?? '저장 중 오류가 발생했습니다. 다시 시도해주세요.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-2xl">
            <KeyRound size={24} className="text-blue-500" />
          </div>
          <h3 className="font-bold text-gray-900 text-base">새 비밀번호를 정해주세요</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            비밀번호를 본인만 아는 값으로 바꿔야 계속 이용할 수 있어요.
            {PASSWORD_MIN_LENGTH}자 이상으로 정해주세요.
          </p>
        </div>

        <div className="space-y-2">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="새 비밀번호"
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="새 비밀번호 확인"
            autoComplete="new-password"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{errorMsg}</p>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-semibold text-sm transition-colors"
        >
          {saving ? <Loader size={16} className="animate-spin" /> : null}
          {saving ? '저장 중...' : '비밀번호 설정'}
        </button>

        <button
          onClick={logout}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
        >
          나중에 하기 (로그아웃)
        </button>
      </div>
    </div>
  )
}
