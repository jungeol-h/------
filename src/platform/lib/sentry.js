// Sentry 에러 모니터링 초기화.
//
// 침묵 실패 방지의 "개발자 도달" 계층. fetcher/도메인의 console.error 가
// 사용자 콘솔에만 남던 것을 Sentry로 보내, 운영 중 에러를 즉시 인지한다.
// DSN(VITE_SENTRY_DSN)이 없으면 자동 비활성 — 앱은 정상 동작한다.

import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN

export function initSentry() {
  if (!dsn) {
    // DSN 미설정 시 조용히 건너뜀 (개발 환경·DSN 미발급 상태)
    return
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // 베타 규모(50-60명)에선 트레이스 샘플링을 낮게 둬 무료 한도를 아낀다.
    tracesSampleRate: 0.1,
  })
}

// 로그인한 사용자 식별 — 어떤 학생/매니저가 겪은 에러인지 추적.
export function setSentryUser(user) {
  if (!dsn) return
  if (user) {
    Sentry.setUser({ id: user.id, username: user.loginId, role: user.role })
  } else {
    Sentry.setUser(null)
  }
}

// 에러를 Sentry로 보냄. context 로 발생 위치·관련 ID를 함께 기록.
export function reportError(error, context) {
  console.error(context?.where ?? 'error', error)
  if (!dsn) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export { Sentry }
