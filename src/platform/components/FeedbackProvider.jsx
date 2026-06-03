// 피드백 모달 상태와 prefill을 전역으로 관리.
// 헤더의 FeedbackButton이 자체 useState로 모달을 열던 패턴을 Context로 이관해
// 외부(ToastProvider의 "신고하기" 버튼)에서도 모달을 prefill과 함께 열 수 있게 한다.

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const FeedbackContext = createContext(null)

export function useFeedback() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider')
  return ctx
}

export function FeedbackProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false)
  const [prefillText, setPrefillText] = useState('')

  const open = useCallback(() => {
    setPrefillText('')
    setIsOpen(true)
  }, [])

  const openWithPrefill = useCallback((text) => {
    setPrefillText(text ?? '')
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo(
    () => ({ isOpen, prefillText, open, openWithPrefill, close }),
    [isOpen, prefillText, open, openWithPrefill, close]
  )

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>
}
