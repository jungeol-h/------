import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 모바일에서 앱을 오래 안 열다가 복귀한 직후에는 네트워크 스택이 깨어나기 전에
// 나간 fetch가 에러도 없이 영원히 pending으로 남을 수 있다 (초기 로딩이 안 끝나는 원인).
// 모든 요청에 타임아웃 상한을 걸어 "무한 대기"를 "실패"로 전환한다 — 실패는
// DataContext의 재시도와 _fetchErrors UI가 받아서 처리한다.
// storage는 대용량 파일 업로드가 있어 상한을 넉넉히 둔다
// (과제 제출 100MB — 느린 회선에서 수 분 걸릴 수 있음).
const REST_TIMEOUT_MS = 15_000
const STORAGE_TIMEOUT_MS = 600_000

function fetchWithTimeout(input, init = {}) {
  if (typeof AbortSignal?.timeout !== 'function') return fetch(input, init)
  const url = typeof input === 'string' ? input : (input?.url ?? '')
  const timeoutSignal = AbortSignal.timeout(
    url.includes('/storage/') ? STORAGE_TIMEOUT_MS : REST_TIMEOUT_MS,
  )
  // 호출부가 이미 abortSignal을 넘긴 경우엔 둘 다 존중한다.
  const signal = init.signal
    ? (typeof AbortSignal.any === 'function' ? AbortSignal.any([init.signal, timeoutSignal]) : init.signal)
    : timeoutSignal
  return fetch(input, { ...init, signal })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
})
