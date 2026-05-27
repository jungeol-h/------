// supabase write 호출을 짧은 백오프로 재시도. 모바일/불안정망에서
// fetch가 일시적으로 죽었을 때 사용자가 "저장 안 됨"으로 느끼지 않게 흡수한다.
//
// 사용 패턴은 기존 도메인 훅의 `{ error }` 구조 그대로 유지:
//   const { error } = await withWriteRetry(() => supabase.from(X)...., { label: 'foo' })
//   if (error) throw error
//
// fetch 자체가 throw하는 경로(Mobile Safari의 TypeError: Load failed 등)도
// 같이 흡수해서 마지막 시도에서만 reject한다.

import { reportError } from './sentry.js'

const BACKOFF_MS = [300, 800, 2000]

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

export async function withWriteRetry(fn, { label } = {}) {
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const result = await fn()
      const err = result?.error
      if (!err) return result
      if (!isRetryable(err) || attempt === BACKOFF_MS.length) {
        if (attempt > 0) reportError(err, { where: label, retryCount: attempt })
        return result
      }
    } catch (e) {
      if (!isRetryable(e) || attempt === BACKOFF_MS.length) {
        reportError(e, { where: label, retryCount: attempt })
        throw e
      }
    }
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]))
  }
  // 도달 불가 — 위 루프에서 항상 return/throw
  throw new Error('withWriteRetry: unreachable')
}
