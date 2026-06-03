// 전역 에러 Toast. 페이지 unmount(탭 전환)에 영향받지 않게 App 상단에서 마운트.
// 기존 SaveErrorBox는 인라인 박스라 새로고침/탭 이동 시 사라져 사용자가
// 캡처할 시간이 없었다. Toast는 10초간 유지되고, "신고하기" 한 번이면
// FeedbackProvider 모달이 컨텍스트 prefill과 함께 열린다.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, MessageSquarePlus, X } from 'lucide-react'
import { useFeedback } from '../FeedbackProvider.jsx'
import { registerErrorToast } from '../../lib/supabaseRetry.js'

const ToastContext = createContext(null)
const TOAST_TTL_MS = 10000

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

function buildPrefill({ label, code, message, eventId }) {
  const lines = [
    '[자동 첨부 — 운영자 확인용]',
    `event: ${eventId ?? '—'}`,
    `위치: ${label ?? '—'}`,
    `코드: ${code ?? '—'}`,
    `메시지: ${message ?? '—'}`,
    `시각: ${new Date().toISOString()}`,
    '───',
    '(위 정보는 자동 추가됨. 어떤 동작 중이었는지 한 줄만 알려주시면 큰 도움됩니다.)',
    '',
    '',
  ]
  return lines.join('\n')
}

export function ToastProvider({ children }) {
  const { openWithPrefill } = useFeedback()
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showErrorToast = useCallback(
    ({ error, label, eventId }) => {
      const id = ++idRef.current
      const toast = {
        id,
        kind: 'error',
        message: error?.message ?? String(error ?? '알 수 없는 오류'),
        eventId: eventId ?? error?.sentryEventId,
        label,
        code: error?.code ?? error?.status,
      }
      setToasts((prev) => [...prev, toast])
      setTimeout(() => dismiss(id), TOAST_TTL_MS)
      return id
    },
    [dismiss]
  )

  // withWriteRetry(모듈 함수)가 최종 실패 시 토스트를 띄울 수 있게 핸들러 등록.
  useEffect(() => registerErrorToast(showErrorToast), [showErrorToast])

  const handleReport = useCallback(
    (toast) => {
      openWithPrefill(buildPrefill(toast))
      dismiss(toast.id)
    },
    [openWithPrefill, dismiss]
  )

  const value = useMemo(() => ({ showErrorToast, dismiss }), [showErrorToast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <ToastStack toasts={toasts} onReport={handleReport} onDismiss={dismiss} />,
          document.body
        )}
    </ToastContext.Provider>
  )
}

function ToastStack({ toasts, onReport, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onReport={onReport} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onReport, onDismiss }) {
  return (
    <div className="pointer-events-auto w-full max-w-md bg-white border border-red-200 rounded-2xl shadow-lg p-3 flex items-start gap-2.5">
      <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0 text-xs text-gray-700">
        <p className="font-semibold text-red-700">저장에 실패했어요</p>
        <p className="mt-0.5 break-words">{toast.message}</p>
        {toast.eventId && (
          <p className="mt-1 text-[10px] text-gray-400">참조 ID: {toast.eventId.slice(0, 8)}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onReport(toast)}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-1.5"
          title="이 오류 신고하기"
        >
          <MessageSquarePlus size={13} />
          <span>신고</span>
        </button>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-gray-400 hover:text-gray-600 p-1"
          aria-label="닫기"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
