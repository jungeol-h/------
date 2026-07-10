import { describe, expect, it } from 'vitest'
import { gradeAttempt, hasPendingGrading, isCorrect } from './quizGrading.js'

const shortQ = (id, answers) => ({ id, type: 'short', acceptedAnswers: answers })
const essayQ = (id) => ({ id, type: 'essay', acceptedAnswers: [] })

describe('gradeAttempt', () => {
  it('단답형은 자동채점, 서술형은 isCorrect null(채점 대기)', () => {
    const questions = [shortQ('q1', ['정답']), essayQ('q2')]
    const { answers, score, total } = gradeAttempt(questions, { q1: '정 답', q2: '서술 답안' })

    expect(answers).toEqual([
      { questionId: 'q1', raw: '정 답', isCorrect: true },
      { questionId: 'q2', raw: '서술 답안', isCorrect: null },
    ])
    expect(score).toBe(1) // 채점 대기는 점수에 포함하지 않음
    expect(total).toBe(2)
  })

  it('type 미지정(기존 데이터)은 단답형으로 자동채점한다', () => {
    const questions = [{ id: 'q1', acceptedAnswers: ['a'] }]
    const { answers, score } = gradeAttempt(questions, { q1: 'b' })
    expect(answers[0].isCorrect).toBe(false)
    expect(score).toBe(0)
  })
})

describe('hasPendingGrading', () => {
  it('isCorrect null 문항이 있으면 true', () => {
    expect(hasPendingGrading({ answers: [{ isCorrect: true }, { isCorrect: null }] })).toBe(true)
    expect(hasPendingGrading({ answers: [{ isCorrect: true }, { isCorrect: false }] })).toBe(false)
    expect(hasPendingGrading(null)).toBe(false)
  })
})

describe('isCorrect', () => {
  it('빈 정답 배열(서술형)은 항상 false', () => {
    expect(isCorrect('아무 답', [])).toBe(false)
  })
})
