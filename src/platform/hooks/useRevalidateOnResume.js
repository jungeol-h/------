// 복귀 재검증 공용 훅 — PWA 장수명 세션에서 낡은 데이터를 되살린다.
//
// 이 앱은 "로그인 시 1회 fetch 후 로컬 동기화" 모델인데 배포 형태는 며칠씩
// 살아있는 standalone PWA다. 백그라운드에 있다가 복귀한 화면은 (1) 다른
// 세션의 변경이 반영되지 않고, (2) 복귀 직후 네트워크 미복구로 실패한 로드를
// 다시 시도할 수단이 없다(브라우저 새로고침 UI가 없다). 이 훅은 복귀
// (visibilitychange→visible)·재연결(online)·bfcache 복원(pageshow persisted)
// 시점에 재검증 콜백을 호출해 그 공백을 메운다. 주기 폴링은 하지 않는다.

import { useEffect, useRef } from 'react'

export const DEFAULT_STALE_MS = 3 * 60 * 1000
export const DEFAULT_MIN_INTERVAL_MS = 10 * 1000

// 순수 팩토리 — 리스너 부착/해제와 실행 판정. React 없이 단위 테스트한다.
//  onRevalidate      async 콜백. reject는 삼킨다 — 소유 모듈이 자체 에러 UI를
//                    갖고 있고, 다음 트리거에서 자연 재시도되기 때문.
//  staleMs           마지막 성공 후 이 시간이 지나야 실행 (신선하면 skip).
//  minIntervalMs     시도 간 최소 간격 — visible+online+pageshow 연쇄 발화 dedupe.
//  getLastSuccessAt  성공 시각을 외부에서 관리하면 주입 (미주입 시 내부 추적).
//  force             () => boolean. true면 staleMs 무시하고 즉시 실행
//                    (에러 배너가 떠 있는 상태 등). in-flight·minInterval은 여전히 차단.
export function createResumeRevalidator({
  onRevalidate,
  staleMs = DEFAULT_STALE_MS,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  getLastSuccessAt,
  force,
} = {}) {
  let running = false
  let lastAttemptAt = 0
  let internalSuccessAt = 0

  const lastSuccessAt = () =>
    (getLastSuccessAt ? getLastSuccessAt() : internalSuccessAt)

  const trigger = async () => {
    if (running) return
    const now = Date.now()
    if (now - lastAttemptAt < minIntervalMs) return
    const forced = force ? Boolean(force()) : false
    if (!forced && now - lastSuccessAt() < staleMs) return
    running = true
    lastAttemptAt = now
    try {
      await onRevalidate()
      internalSuccessAt = Date.now()
    } catch {
      // 실패는 삼킨다 — lastSuccess 미갱신이므로 다음 트리거가 재시도한다.
    } finally {
      running = false
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') trigger()
  }
  const onOnline = () => trigger()
  const onPageShow = (event) => {
    if (event.persisted) trigger()
  }

  const start = () => {
    // 시작 시점을 "방금 로드됨"으로 간주 — 마운트 직후 복귀 이벤트에 바로 발화하지 않게.
    internalSuccessAt = Date.now()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    window.addEventListener('pageshow', onPageShow)
  }

  const stop = () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('pageshow', onPageShow)
  }

  return { start, stop, trigger }
}

// React 래퍼. callback/getLastSuccessAt/force는 ref로 최신 클로저를 유지해
// 값이 바뀌어도 리스너를 재구독하지 않는다. 마운트 시 즉시 실행하지 않는다
// (초기 로드는 각 모듈이 이미 수행).
export function useRevalidateOnResume(callback, {
  staleMs = DEFAULT_STALE_MS,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  getLastSuccessAt,
  force,
  enabled = true,
} = {}) {
  const latestRef = useRef({ callback, getLastSuccessAt, force })
  useEffect(() => {
    latestRef.current = { callback, getLastSuccessAt, force }
  })
  const hasExternalClock = Boolean(getLastSuccessAt)

  useEffect(() => {
    if (!enabled) return undefined
    const revalidator = createResumeRevalidator({
      onRevalidate: () => latestRef.current.callback(),
      staleMs,
      minIntervalMs,
      getLastSuccessAt: hasExternalClock
        ? () => latestRef.current.getLastSuccessAt()
        : undefined,
      force: () => (latestRef.current.force ? Boolean(latestRef.current.force()) : false),
    })
    revalidator.start()
    return () => revalidator.stop()
  }, [enabled, staleMs, minIntervalMs, hasExternalClock])
}
