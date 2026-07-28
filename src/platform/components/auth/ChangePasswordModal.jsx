// 상시 비밀번호 변경 모달 — Header의 열쇠 버튼에서 연다 (전 역할 공용).
// 현재 비밀번호를 확인한 뒤 새 비밀번호로 교체한다.

import { useState } from 'react'
import { X, KeyRound, Loader } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { validateNewPassword } from '../../lib/passwords.js'

export default function ChangePasswordModal({ onClose }) {
  const { currentUser, changePassword } = useAuth()
  const [currentPw, setCurrentPw] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [done, setDone] = useState(false)

  const canSave = !saving && currentPw && pw && pw2

  const handleSave = async () => {
    setErrorMsg('')
    const invalid = validateNewPassword(pw, {
      forbidden: [currentUser?.phone, currentUser?.parentPhone],
    })
    if (invalid) {
      setErrorMsg(invalid)
      return
    }
    if (pw !== pw2) {
      setErrorMsg('새 비밀번호가 서로 다릅니다. 같은 값을 두 번 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await changePassword(currentPw, pw)
      setDone(true)
    } catch (err) {
      setErrorMsg(err?.message ?? '저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <KeyRound size={18} className="text-blue-500" />
            비밀번호 변경
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {done ? (
          <>
            <p className="text-sm text-gray-700 bg-emerald-50 rounded-xl px-4 py-3">
              비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm"
            >
              닫기
            </button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="현재 비밀번호"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              />
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="새 비밀번호 (8자 이상)"
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
              {saving ? '저장 중...' : '변경하기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
