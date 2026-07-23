import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import QuizTab from './QuizTab.jsx'

const submitQuizAttempt = vi.fn()

const data = {
  students: [{ id: 's001', grade: '중1' }],
  quizSets: [
    {
      id: 'qs-1',
      grade: '중1',
      round: 1,
      title: '중1 확인평가 1회',
      description: '',
      isPublished: true,
    },
    {
      id: 'qs-2',
      grade: '중1',
      round: 2,
      title: '중1 확인평가 2회',
      description: '',
      isPublished: true,
    },
  ],
  quizQuestions: [
    {
      id: 'q1',
      quizSetId: 'qs-1',
      orderNo: 1,
      question: '첫 번째 문제',
      acceptedAnswers: ['정답1'],
    },
    {
      id: 'q2',
      quizSetId: 'qs-1',
      orderNo: 2,
      question: '두 번째 문제',
      acceptedAnswers: ['정답2'],
    },
    {
      id: 'q3',
      quizSetId: 'qs-2',
      orderNo: 1,
      type: 'essay',
      question: '서술형 문제',
      acceptedAnswers: [],
    },
  ],
  quizAttempts: [],
}

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ currentUser: { id: 's001', grade: '중1', role: 'student' } }),
}))

vi.mock('../../context/DataContext.jsx', () => ({
  useData: () => ({ data, submitQuizAttempt }),
}))

function openQuiz() {
  render(<QuizTab />)
  fireEvent.click(screen.getByText('중1 확인평가 1회'))
}

beforeEach(() => {
  submitQuizAttempt.mockReset()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('QuizTab draft protection', () => {
  it('답안을 입력한 상태에서 나가기 취소를 거부하면 응시 상태와 답안을 유지한다', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    openQuiz()

    fireEvent.change(screen.getByPlaceholderText('정답을 입력하세요'), {
      target: { value: '내 답안' },
    })
    fireEvent.click(screen.getByText('나가기 (응시 취소)'))

    expect(window.confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText('첫 번째 문제')).toBeTruthy()
    expect(screen.getByPlaceholderText('정답을 입력하세요').value).toBe('내 답안')
  })

  it('저장된 초안이 있으면 같은 회차를 열 때 답안과 문항 위치를 복구한다', () => {
    localStorage.setItem(
      'quiz_draft:s001:qs-1',
      JSON.stringify({ step: 1, rawByQid: { q2: '복구 답안' }, updatedAt: '2026-06-03T00:00:00.000Z' })
    )

    openQuiz()

    expect(screen.getByText('두 번째 문제')).toBeTruthy()
    expect(screen.getByText('2 / 2')).toBeTruthy()
    expect(screen.getByPlaceholderText('정답을 입력하세요').value).toBe('복구 답안')
  })

  it('제출 성공 시 저장된 초안을 삭제한다', async () => {
    submitQuizAttempt.mockResolvedValue({
      quizSetId: 'qs-1',
      score: 1,
      total: 2,
      answers: [{ questionId: 'q1', raw: '정답1', isCorrect: true }],
    })
    openQuiz()

    fireEvent.change(screen.getByPlaceholderText('정답을 입력하세요'), {
      target: { value: '정답1' },
    })
    fireEvent.click(screen.getByText('다음'))
    fireEvent.change(screen.getByPlaceholderText('정답을 입력하세요'), {
      target: { value: '정답2' },
    })
    expect(localStorage.getItem('quiz_draft:s001:qs-1')).toBeTruthy()

    fireEvent.click(screen.getByText('제출하기'))

    await waitFor(() => {
      expect(submitQuizAttempt).toHaveBeenCalledWith('s001', 'qs-1', { q1: '정답1', q2: '정답2' })
    })
    expect(localStorage.getItem('quiz_draft:s001:qs-1')).toBeNull()
  })
})

describe('QuizTab 서술형 문항', () => {
  it('서술형 문항은 textarea로 입력하고 수동 채점 안내를 보여준다', () => {
    render(<QuizTab />)
    fireEvent.click(screen.getByText('중1 확인평가 2회'))

    expect(screen.getByPlaceholderText('답안을 작성하세요').tagName).toBe('TEXTAREA')
    expect(screen.getByText('서술형 문항은 제출 후 선생님이 직접 채점합니다.')).toBeTruthy()
  })
})

describe('QuizTab 채점 대기 표시', () => {
  beforeEach(() => {
    data.quizAttempts.push({
      id: 'qa-1',
      studentId: 's001',
      quizSetId: 'qs-2',
      score: 0,
      total: 1,
      submittedAt: '2026-07-01T00:00:00.000Z',
      answers: [{ questionId: 'q3', raw: '서술 답안', isCorrect: null }],
    })
  })

  afterEach(() => {
    data.quizAttempts.length = 0
  })

  it('목록과 결과 화면에 채점 대기 상태를 보여준다', () => {
    render(<QuizTab />)
    expect(screen.getByText(/채점 대기 중/)).toBeTruthy()

    fireEvent.click(screen.getByText('중1 확인평가 2회'))
    expect(screen.getByText(/선생님 채점 후 점수가 갱신됩니다/)).toBeTruthy()
    expect(screen.getByText('채점 대기 — 선생님이 확인 후 채점합니다')).toBeTruthy()
  })
})

describe('QuizTab 서술형 부분점수 표시', () => {
  beforeEach(() => {
    data.quizAttempts.push({
      id: 'qa-2',
      studentId: 's001',
      quizSetId: 'qs-2',
      score: 3,
      total: 5,
      submittedAt: '2026-07-01T00:00:00.000Z',
      answers: [{ questionId: 'q3', raw: '서술 답안', points: 5, isCorrect: false, earned: 3 }],
    })
  })

  afterEach(() => {
    data.quizAttempts.length = 0
  })

  it('채점된 서술형은 "득점: X / Y점"을 보여주고 채점 대기가 아니다', () => {
    render(<QuizTab />)
    fireEvent.click(screen.getByText('중1 확인평가 2회'))

    expect(screen.getByText('3 / 5점')).toBeTruthy()
    expect(screen.queryByText('채점 대기 — 선생님이 확인 후 채점합니다')).toBeNull()
  })
})
