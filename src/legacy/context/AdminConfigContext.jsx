import { createContext, useContext, useEffect, useState } from 'react'
import { loadAdminConfig } from '../lib/adminConfig'
import { feedbackLibrary as defaultFeedback, practiceCards as defaultCards } from '../data/feedbackLibrary'

const AdminConfigContext = createContext(null)

export function AdminConfigProvider({ children }) {
  const [config, setConfig] = useState({
    feedbackLibrary: defaultFeedback,
    practiceCards: defaultCards,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAdminConfig().then(loaded => {
      setConfig(loaded)
      setLoading(false)
    })
  }, [])

  function refreshConfig() {
    return loadAdminConfig().then(loaded => setConfig(loaded))
  }

  return (
    <AdminConfigContext.Provider value={{ config, loading, refreshConfig, setConfig }}>
      {children}
    </AdminConfigContext.Provider>
  )
}

export function useAdminConfig() {
  return useContext(AdminConfigContext)
}
