import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./sentry.js', () => ({
  reportError: vi.fn(),
}))

import { withWriteRetry } from './supabaseRetry.js'
import { reportError } from './sentry.js'

beforeEach(() => {
  vi.useFakeTimers()
  reportError.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

async function flush() {
  // 백오프 setTimeout을 다 통과시키되, 각 await 사이에 microtask도 흘려보낸다.
  for (let i = 0; i < 5; i++) {
    await vi.advanceTimersByTimeAsync(3000)
  }
}

describe('withWriteRetry', () => {
  it('1회 TypeError(Load failed) 후 성공 → data 반환, Sentry 보고 없음', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValueOnce({ data: { ok: true }, error: null })

    const promise = withWriteRetry(fn, { label: 't' })
    await flush()
    const result = await promise

    expect(result).toEqual({ data: { ok: true }, error: null })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('4회 모두 TypeError → throw, Sentry 1회 보고', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('Load failed'))

    const promise = withWriteRetry(fn, { label: 't' })
    // promise가 reject되는 것을 잡아두고 타이머를 흘려보낸다.
    const assertion = expect(promise).rejects.toThrow('Load failed')
    await flush()
    await assertion

    expect(fn).toHaveBeenCalledTimes(4)
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({ where: 't', retryCount: 3 })
    )
  })

  it('PostgreSQL unique violation(23505) → 즉시 반환 + Sentry 보고 (가시성 우선)', async () => {
    reportError.mockReturnValue('evt-23505')
    const fn = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } })

    const result = await withWriteRetry(fn, { label: 't' })

    expect(result.error.code).toBe('23505')
    expect(result.error.sentryEventId).toBe('evt-23505')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  it('401 인증 에러 → 즉시 반환 + Sentry 보고', async () => {
    reportError.mockReturnValue('evt-401')
    const fn = vi.fn().mockResolvedValue({ data: null, error: { status: 401, message: 'Unauthorized' } })

    const result = await withWriteRetry(fn, { label: 't' })

    expect(result.error.status).toBe(401)
    expect(result.error.sentryEventId).toBe('evt-401')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  it('503 후 성공 → 재시도하여 성공', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { status: 503, message: 'Service Unavailable' } })
      .mockResolvedValueOnce({ data: { ok: true }, error: null })

    const promise = withWriteRetry(fn, { label: 't' })
    await flush()
    const result = await promise

    expect(result).toEqual({ data: { ok: true }, error: null })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(reportError).not.toHaveBeenCalled()
  })
})
