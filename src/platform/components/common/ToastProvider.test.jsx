/* eslint-disable no-unused-vars */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from './ToastProvider.jsx'
import { FeedbackProvider, useFeedback } from '../FeedbackProvider.jsx'

function Harness({ onShow }) {
  const { showErrorToast } = useToast()
  return (
    <button
      onClick={() =>
        showErrorToast({
          error: { message: '네트워크가 끊겼어요', code: 'PGRST116', sentryEventId: 'evt-abc1234567' },
          label: 'addTodoItem',
        })
      }
      data-testid="trigger"
    />
  )
}

function FeedbackProbe() {
  const { isOpen, prefillText } = useFeedback()
  return (
    <div>
      <span data-testid="feedback-open">{isOpen ? 'open' : 'closed'}</span>
      <pre data-testid="feedback-prefill">{prefillText}</pre>
    </div>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ToastProvider', () => {
  it('showErrorToast 호출 시 토스트 노출, 10초 후 자동 소멸', () => {
    render(
      <FeedbackProvider>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </FeedbackProvider>
    )
    act(() => {
      fireEvent.click(screen.getByTestId('trigger'))
    })
    expect(screen.getByText('네트워크가 끊겼어요')).toBeTruthy()
    expect(screen.getByText('참조 ID: evt-abc1')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(10001)
    })
    expect(screen.queryByText('네트워크가 끊겼어요')).toBeNull()
  })

  it('"신고" 버튼 클릭 시 Feedback 모달 prefill 채워서 열림', () => {
    render(
      <FeedbackProvider>
        <ToastProvider>
          <Harness />
          <FeedbackProbe />
        </ToastProvider>
      </FeedbackProvider>
    )
    act(() => {
      fireEvent.click(screen.getByTestId('trigger'))
    })
    expect(screen.getByTestId('feedback-open').textContent).toBe('closed')

    act(() => {
      fireEvent.click(screen.getByTitle('이 오류 신고하기'))
    })

    expect(screen.getByTestId('feedback-open').textContent).toBe('open')
    const prefill = screen.getByTestId('feedback-prefill').textContent
    expect(prefill).toContain('event: evt-abc1234567')
    expect(prefill).toContain('위치: addTodoItem')
    expect(prefill).toContain('코드: PGRST116')
    expect(prefill).toContain('메시지: 네트워크가 끊겼어요')
  })

  it('닫기 버튼 클릭 시 즉시 소멸', () => {
    render(
      <FeedbackProvider>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </FeedbackProvider>
    )
    act(() => {
      fireEvent.click(screen.getByTestId('trigger'))
    })
    expect(screen.getByText('네트워크가 끊겼어요')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByLabelText('닫기'))
    })
    expect(screen.queryByText('네트워크가 끊겼어요')).toBeNull()
  })
})
