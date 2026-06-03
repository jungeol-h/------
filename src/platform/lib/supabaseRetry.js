// supabase write 호출을 짧은 백오프로 재시도. 모바일/불안정망에서
// fetch가 일시적으로 죽었을 때 사용자가 "저장 안 됨"으로 느끼지 않게 흡수한다.
//
// 사용 패턴은 기존 도메인 훅의 `{ error }` 구조 그대로 유지:
//   const { error } = await withWriteRetry(() => supabase.from(X)...., { label: 'foo' })
//   if (error) throw error
//
// fetch 자체가 throw하는 경로(Mobile Safari의 TypeError: Load failed 등)도
// 같이 흡수해서 마지막 시도에서만 reject한다.
//
// 모든 최종 실패는 Sentry로 보고하고, event_id를 error 객체에 sentryEventId 로
// 부착해 호출자(Toast UI)가 신고 본문 prefill에 사용할 수 있게 한다.

import { reportError } from './sentry.js'

const BACKOFF_MS = [300, 800, 2000]

// 전역 토스트 브리지 — ToastProvider가 마운트되며 자신의 showErrorToast를 등록한다.
// withWriteRetry는 모듈 함수라 React context에 직접 접근할 수 없으므로, 최종 실패
// 시점에 이 슬롯을 통해 토스트를 띄운다. 등록 전(로그인 화면 등)이면 조용히 건너뛴다.
let toastHandler = null
export function registerErrorToast(fn) {
  toastHandler = fn
  return () => { if (toastHandler === fn) toastHandler = null }
}
function emitErrorToast(error, label) {
  if (!toastHandler) return
  try {
    toastHandler({ error, label, eventId: error?.sentryEventId })
  } catch {
    // 토스트 실패가 원래 에러 흐름을 막지 않도록 무시
  }
}

function isRetryable(error) {
  if (!error) return false
  if (error instanceof TypeError) return true
  const msg = String(error?.message ?? '').toLowerCase()
  if (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed')
  ) {
    return true
  }
  const status = typeof error?.status === 'number' ? error.status : null
  if (status && status >= 500 && status < 600) return true
  return false
}

function attachEventId(error, eventId) {
  if (!eventId || !error || typeof error !== 'object') return
  try {
    error.sentryEventId = eventId
  } catch {
    // frozen object 등 — 무시
  }
}

export async function withWriteRetry(fn, { label } = {}) {
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const result = await fn()
      const err = result?.error
      if (!err) return result
      if (!isRetryable(err) || attempt === BACKOFF_MS.length) {
        const eventId = reportError(err, { where: label, retryCount: attempt })
        attachEventId(err, eventId)
        emitErrorToast(err, label)
        return result
      }
    } catch (e) {
      if (!isRetryable(e) || attempt === BACKOFF_MS.length) {
        const eventId = reportError(e, { where: label, retryCount: attempt })
        attachEventId(e, eventId)
        emitErrorToast(e, label)
        throw e
      }
    }
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]))
  }
  // 도달 불가 — 위 루프에서 항상 return/throw
  throw new Error('withWriteRetry: unreachable')
}
