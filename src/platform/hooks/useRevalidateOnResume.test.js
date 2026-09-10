import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createResumeRevalidator } from './useRevalidateOnResume.js'

// createResumeRevalidator 순수 팩토리 단위 테스트 — React 래퍼는 제외.
// 시간 판정(staleMs/minIntervalMs)은 Date.now() 기반이라 fake timers +
// setSystemTime으로 시계를 직접 움직인다.

const BASE = 1_700_000_000_000 // 임의 기준 시각

// jsdom의 document.visibilityState는 읽기 전용이라 defineProperty로 덮어쓴다
function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

function fireVisibilityChange(state = 'visible') {
  setVisibility(state)
  document.dispatchEvent(new Event('visibilitychange'))
}

function fireOnline() {
  window.dispatchEvent(new Event('online'))
}

// jsdom에 PageTransitionEvent가 없을 수 있어 일반 Event에 persisted를 얹는다
function firePageShow(persisted) {
  window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }))
}

// trigger는 async — dispatch 후 마이크로태스크를 소진해야 호출 여부가 확정된다
async function flush() {
  await vi.advanceTimersByTimeAsync(0)
}

describe('createResumeRevalidator', () => {
  let started // 테스트가 start()한 revalidator들 — 리스너 누수 방지용 정리 목록

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE)
    setVisibility('visible')
    started = []
  })

  afterEach(() => {
    started.forEach((r) => r.stop())
    vi.useRealTimers()
  })

  function make(opts) {
    const revalidator = createResumeRevalidator(opts)
    revalidator.start()
    started.push(revalidator)
    return revalidator
  }

  it('staleMs 경과 전 visible 복귀는 skip, 경과 후 복귀는 실행한다', async () => {
    const onRevalidate = vi.fn().mockResolvedValue()
    make({ onRevalidate, staleMs: 1000, minIntervalMs: 0 })

    // start 직후 = 방금 로드됨 → 아직 신선
    vi.setSystemTime(BASE + 999)
    fireVisibilityChange('visible')
    await flush()
    expect(onRevalidate).not.toHaveBeenCalled()

    vi.setSystemTime(BASE + 1001)
    fireVisibilityChange('visible')
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(1)
  })

  it('force()=true면 staleMs 미경과여도 실행하되 minIntervalMs 이내 재발화는 차단한다', async () => {
    const onRevalidate = vi.fn().mockResolvedValue()
    make({ onRevalidate, staleMs: 60_000, minIntervalMs: 1000, force: () => true })

    // staleMs 한참 전인데 force로 즉시 실행
    vi.setSystemTime(BASE + 100)
    fireVisibilityChange('visible')
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(1)

    // minInterval 이내 재발화 — force여도 차단
    vi.setSystemTime(BASE + 100 + 999)
    fireVisibilityChange('visible')
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(1)

    // minInterval 경과 후에는 다시 실행
    vi.setSystemTime(BASE + 100 + 1001)
    fireVisibilityChange('visible')
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(2)
  })

  it('visible+online 연쇄 발화(200ms 간격)는 minInterval dedupe로 1회만 실행한다', async () => {
    const onRevalidate = vi.fn().mockResolvedValue()
    make({ onRevalidate, staleMs: 1000, minIntervalMs: 10_000 })

    vi.setSystemTime(BASE + 2000) // 이미 stale
    fireVisibilityChange('visible')
    await flush()
    vi.setSystemTime(BASE + 2200)
    fireOnline()
    await flush()

    expect(onRevalidate).toHaveBeenCalledTimes(1)
  })

  it('실행 중(in-flight)에는 minInterval=0이어도 중복 실행하지 않는다', async () => {
    let resolveRun
    const onRevalidate = vi.fn(() => new Promise((resolve) => { resolveRun = resolve }))
    make({ onRevalidate, staleMs: 1000, minIntervalMs: 0 })

    vi.setSystemTime(BASE + 2000)
    fireVisibilityChange('visible')
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(1)

    // 첫 실행이 아직 pending인 상태에서 연쇄 발화
    fireOnline()
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(1)

    resolveRun()
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(1)
  })

  it("visibilityState 'hidden'의 visibilitychange는 실행하지 않는다", async () => {
    const onRevalidate = vi.fn().mockResolvedValue()
    make({ onRevalidate, staleMs: 1000, minIntervalMs: 0 })

    vi.setSystemTime(BASE + 2000) // stale이어도 hidden이면 skip
    fireVisibilityChange('hidden')
    await flush()
    expect(onRevalidate).not.toHaveBeenCalled()
  })

  it('pageshow는 persisted=true(bfcache 복원)일 때만 실행한다', async () => {
    const onRevalidate = vi.fn().mockResolvedValue()
    make({ onRevalidate, staleMs: 1000, minIntervalMs: 0 })

    vi.setSystemTime(BASE + 2000)
    firePageShow(false) // 일반 로드 → skip
    await flush()
    expect(onRevalidate).not.toHaveBeenCalled()

    firePageShow(true) // bfcache 복원 → 실행
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(1)
  })

  it('stop() 후에는 어떤 이벤트에도 실행하지 않는다', async () => {
    const onRevalidate = vi.fn().mockResolvedValue()
    const revalidator = make({ onRevalidate, staleMs: 1000, minIntervalMs: 0 })
    revalidator.stop()

    vi.setSystemTime(BASE + 2000)
    fireVisibilityChange('visible')
    fireOnline()
    firePageShow(true)
    await flush()
    expect(onRevalidate).not.toHaveBeenCalled()
  })

  it('onRevalidate reject는 삼키고, lastSuccess 미갱신이라 다음 트리거가 재시도한다', async () => {
    const onRevalidate = vi.fn().mockRejectedValue(new Error('boom'))
    make({ onRevalidate, staleMs: 1000, minIntervalMs: 500 })

    vi.setSystemTime(BASE + 2000)
    fireVisibilityChange('visible')
    await flush() // unhandled rejection 없이 소진되어야 한다
    expect(onRevalidate).toHaveBeenCalledTimes(1)

    // 실패라 lastSuccess 미갱신 → minInterval만 지나면 여전히 stale이라 재실행
    vi.setSystemTime(BASE + 2000 + 501)
    fireVisibilityChange('visible')
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(2)
  })

  it('getLastSuccessAt 주입 시 내부 시각 대신 그 시각으로 staleness를 판정한다', async () => {
    const onRevalidate = vi.fn().mockResolvedValue()
    let externalSuccessAt = BASE // 외부 시계
    make({
      onRevalidate,
      staleMs: 1000,
      minIntervalMs: 0,
      getLastSuccessAt: () => externalSuccessAt,
    })

    // 외부 시계 기준 신선 → skip (내부는 start 시각이지만 무시되어야 한다)
    externalSuccessAt = BASE + 5000
    vi.setSystemTime(BASE + 5500)
    fireVisibilityChange('visible')
    await flush()
    expect(onRevalidate).not.toHaveBeenCalled()

    // 외부 시계 기준 stale → 실행 (내부 성공 시각이 갱신돼도 외부가 기준)
    externalSuccessAt = BASE
    fireVisibilityChange('visible')
    await flush()
    expect(onRevalidate).toHaveBeenCalledTimes(1)
  })
})
