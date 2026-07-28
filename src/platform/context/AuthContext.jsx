import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toUser } from '../lib/supabaseHelpers'
import { reportError, setSentryUser } from '../lib/sentry.js'
import { hashPassword, verifyOrPlaintext } from '../lib/passwords.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('platform_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('platform_user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('platform_user')
    }
  }, [currentUser])

  // 계정 조회 후 클라이언트에서 비밀번호 검증 — 저장값이 bcrypt 해시면 compare,
  // 미전환 계정(평문)이면 문자열 비교 후 그 자리에서 해시로 교체(투명 업그레이드).
  const login = async (loginId, password) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('login_id', loginId.trim())
        .eq('status', 'active')
        .single()

      const verdict = dbError || !data
        ? { ok: false }
        : await verifyOrPlaintext(password.trim(), data.password)
      if (!verdict.ok) {
        // 계정 존재 여부를 드러내지 않도록 실패 문구는 하나로 통일
        setError('학번 또는 비밀번호가 올바르지 않습니다.')
        return false
      }

      if (verdict.wasPlaintext) {
        // 평문 소멸 경로 — 실패해도 로그인은 진행 (다음 로그인 때 재시도).
        // .eq('password', ...)로 저장값이 그대로일 때만 교체 — 직후의 강제
        // 재설정이 새 비밀번호를 쓴 경우 덮어쓰지 않는다 (compare-and-set).
        hashPassword(password.trim())
          .then((hash) => supabase.from('users').update({ password: hash })
            .eq('id', data.id).eq('password', data.password))
          .then(({ error: upErr }) => {
            if (upErr) reportError(upErr, { where: 'login.hashUpgrade' })
          })
          .catch((e) => reportError(e, { where: 'login.hashUpgrade' }))
      }

      const user = toUser(data)
      setCurrentUser(user)
      setSentryUser(user)
      // 로그인 기록 — 실패해도 로그인 흐름을 막지 않는다 (fire-and-forget)
      supabase.from('login_logs').insert({ user_id: user.id }).then(({ error: logError }) => {
        if (logError) reportError(logError, { where: 'login.logInsert' })
      })
      return user
    } catch (e) {
      reportError(e, { where: 'login' })
      setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('platform_user')
    localStorage.removeItem('platform_data')
  }

  // 새 비밀번호를 해시로 저장하고 강제 재설정 플래그를 해제한다.
  const savePassword = async (userId, newPassword) => {
    const changedAt = new Date().toISOString()
    const { error: upErr } = await supabase
      .from('users')
      .update({ password: await hashPassword(newPassword), password_changed_at: changedAt })
      .eq('id', userId)
    if (upErr) throw upErr
    setCurrentUser((prev) => (prev ? { ...prev, passwordChangedAt: changedAt } : prev))
  }

  // 강제 재설정 완료 — 직전에 로그인으로 본인 증명이 됐으므로 현재 비밀번호 확인 생략
  const completeForcedReset = async (newPassword) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.')
    await savePassword(currentUser.id, newPassword)
  }

  // 상시 비밀번호 변경 — 현재 비밀번호를 DB 재조회로 확인한 뒤 교체
  const changePassword = async (currentPassword, newPassword) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.')
    const { data, error: dbError } = await supabase
      .from('users')
      .select('password')
      .eq('id', currentUser.id)
      .single()
    if (dbError || !data) throw new Error('사용자 정보를 확인하지 못했습니다. 다시 시도해주세요.')
    const { ok } = await verifyOrPlaintext(currentPassword, data.password)
    if (!ok) throw new Error('현재 비밀번호가 올바르지 않습니다.')
    await savePassword(currentUser.id, newPassword)
  }

  // 강제 재설정 대상: 본인이 비밀번호를 정한 적이 없는 계정.
  // 구버전 localStorage 세션은 passwordChangedAt 키가 없어(undefined) 자연히 대상이 된다.
  const mustChangePassword = !!currentUser && currentUser.passwordChangedAt == null

  return (
    <AuthContext.Provider
      value={{
        currentUser, login, logout, loading, error,
        changePassword, completeForcedReset, mustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
