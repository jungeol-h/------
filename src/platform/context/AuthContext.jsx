import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const QUICK_USERS = {
  student: { id: 's1', name: '김안동', role: 'student', school: '안동중', grade: '중2' },
  manager: { id: 'e2', name: '박지현', role: 'manager' },
  admin: { id: 'a1', name: '관리자', role: 'admin' },
  parent: { id: 'p1', name: '김부모', role: 'parent' },
  teacher: { id: 'e1', name: '최민수', role: 'teacher' },
  consultant: { id: 'c1', name: '이컨설턴트', role: 'consultant' },
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('platform_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('platform_user', JSON.stringify(currentUser))
    } else {
      localStorage.removeItem('platform_user')
    }
  }, [currentUser])

  const login = (role) => {
    const user = QUICK_USERS[role]
    if (user) setCurrentUser(user)
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('platform_user')
  }

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
