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
  // 강제 재설정 판정을 localStorage 스냅샷만으로 내리지 않기 위한 게이트.
  // 확인 전에는 모달을 띄우지 않는다 (기기마다 재설정을 또 시키는 사고 방지).
  const [resetFlagVerified, setResetFlagVerified] = useState(false)

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('platform_user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('platform_user')
    }
  }, [currentUser])

  // 세션에 passwordChangedAt이 없으면 모달을 띄우기 전에 DB로 재확인한다.
  // 다른 기기에서 이미 재설정을 마친 옛 세션이면 플래그만 동기화하고 통과.
  useEffect(() => {
    const userId = currentUser?.id
    if (!userId || currentUser.passwordChangedAt != null) return
    let cancelled = false
    supabase
      .from('users')
      .select('password_changed_at')
      .eq('id', userId)
      .single()
      .then(({ data, error: dbError }) => {
        if (cancelled) return
        if (!dbError && data?.password_changed_at) {
          setCurrentUser((prev) =>
            prev && prev.id === userId
              ? { ...prev, passwordChangedAt: data.password_changed_at }
              : prev
          )
        } else {
          // 진짜 미설정(또는 조회 실패) — 모달을 띄운다. 덮어쓰기는
          // completeForcedReset의 first-write-wins 가드가 한 번 더 막는다.
          setResetFlagVerified(true)
        }
      })
    return () => { cancelled = true }
  }, [currentUser?.id, currentUser?.passwordChangedAt])

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

  // 강제 재설정 완료 — 직전에 로그인으로 본인 증명이 됐으므로 현재 비밀번호 확인 생략.
  // password_changed_at IS NULL 조건부 갱신(first-write-wins): 다른 기기에서
  // 이미 재설정했으면 그 비밀번호를 덮어쓰지 않고 alreadyReset으로 알린다.
  const completeForcedReset = async (newPassword) => {
    if (!currentUser) throw new Error('로그인이 필요합니다.')
    const changedAt = new Date().toISOString()
    const { data, error: upErr } = await supabase
      .from('users')
      .update({ password: await hashPassword(newPassword), password_changed_at: changedAt })
      .eq('id', currentUser.id)
      .is('password_changed_at', null)
      .select('id')
    if (upErr) throw upErr
    if (!data || data.length === 0) {
      const { data: fresh } = await supabase
        .from('users')
        .select('password_changed_at')
        .eq('id', currentUser.id)
        .single()
      return { alreadyReset: true, changedAt: fresh?.password_changed_at ?? changedAt }
    }
    setCurrentUser((prev) => (prev ? { ...prev, passwordChangedAt: changedAt } : prev))
    return { alreadyReset: false }
  }

  // alreadyReset 안내를 사용자가 확인한 뒤 모달을 내리기 위한 로컬 플래그 동기화
  const syncPasswordChangedAt = (changedAt) => {
    setCurrentUser((prev) => (prev ? { ...prev, passwordChangedAt: changedAt } : prev))
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
  // 단, localStorage 세션의 판정은 위 useEffect가 DB로 재확인한 뒤에만 유효
  // (resetFlagVerified) — 다른 기기에서 이미 재설정한 옛 세션에 또 띄우지 않는다.
  const mustChangePassword =
    !!currentUser && currentUser.passwordChangedAt == null && resetFlagVerified

  return (
    <AuthContext.Provider
      value={{
        currentUser, login, logout, loading, error,
        changePassword, completeForcedReset, mustChangePassword, syncPasswordChangedAt,
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
