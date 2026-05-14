import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toUser } from '../lib/supabaseHelpers'

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

  const login = async (loginId, password) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('login_id', loginId.trim())
        .eq('password', password.trim())
        .eq('status', 'active')
        .single()

      if (dbError || !data) {
        setError('학번 또는 비밀번호가 올바르지 않습니다.')
        return false
      }

      const user = toUser(data)
      setCurrentUser(user)
      return true
    } catch {
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

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
