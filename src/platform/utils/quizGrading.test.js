import { describe, expect, it } from 'vitest'
import {
  answerEarned, answerPoints, gradeAttempt, hasPendingGrading, isCorrect, isPendingAnswer,
} from './quizGrading.js'

const shortQ = (id, answers) => ({ id, type: 'short', acceptedAnswers: answers })
const essayQ = (id, points) => ({ id, type: 'essay', acceptedAnswers: [], points })

describe('gradeAttempt', () => {
  it('단답형은 자동채점(정답=배점 득점), 서술형은 isCorrect/earned null(채점 대기)', () => {
    const questions = [shortQ('q1', ['정답']), essayQ('q2', 5)]
    const { answers, score, total } = gradeAttempt(questions, { q1: '정 답', q2: '서술 답안' })

    expect(answers).toEqual([
      { questionId: 'q1', raw: '정 답', points: 1, isCorrect: true, earned: 1 },
      { questionId: 'q2', raw: '서술 답안', points: 5, isCorrect: null, earned: null },
    ])
    expect(score).toBe(1) // 채점 대기는 점수에 포함하지 않음
    expect(total).toBe(6) // total은 배점 합
  })

  it('type·points 미지정(기존 데이터)은 단답형 1점으로 자동채점한다', () => {
    const questions = [{ id: 'q1', acceptedAnswers: ['a'] }]
    const { answers, score, total } = gradeAttempt(questions, { q1: 'b' })
    expect(answers[0].isCorrect).toBe(false)
    expect(answers[0].earned).toBe(0)
    expect(answers[0].points).toBe(1)
    expect(score).toBe(0)
    expect(total).toBe(1)
  })
})

describe('answerPoints / answerEarned / isPendingAnswer', () => {
  it('points/earned 스냅샷이 있으면 그대로 사용한다', () => {
    const a = { points: 5, earned: 3, isCorrect: false }
    expect(answerPoints(a)).toBe(5)
    expect(answerEarned(a)).toBe(3) // 부분점수 — isCorrect보다 earned 우선
    expect(isPendingAnswer(a)).toBe(false)
  })

  it('레거시 답안(points/earned 없음)은 1점·isCorrect 기반으로 해석한다', () => {
    expect(answerPoints({ isCorrect: true })).toBe(1)
    expect(answerEarned({ isCorrect: true })).toBe(1)
    expect(answerEarned({ isCorrect: false })).toBe(0)
    expect(answerEarned({ isCorrect: null })).toBe(null)
    expect(isPendingAnswer({ isCorrect: null })).toBe(true)
    expect(isPendingAnswer({ isCorrect: false })).toBe(false)
  })

  it('서술형 채점 대기(earned null)는 pending', () => {
    expect(isPendingAnswer({ points: 5, earned: null, isCorrect: null })).toBe(true)
    expect(isPendingAnswer({ points: 5, earned: 0, isCorrect: false })).toBe(false)
  })
})

describe('hasPendingGrading', () => {
  it('채점 대기 문항이 있으면 true (신규 earned·레거시 isCorrect 모두)', () => {
    expect(hasPendingGrading({ answers: [{ isCorrect: true }, { isCorrect: null }] })).toBe(true)
    expect(hasPendingGrading({ answers: [{ isCorrect: true }, { isCorrect: false }] })).toBe(false)
    expect(hasPendingGrading({ answers: [{ points: 5, earned: null, isCorrect: null }] })).toBe(true)
    expect(hasPendingGrading({ answers: [{ points: 5, earned: 3, isCorrect: false }] })).toBe(false)
    expect(hasPendingGrading(null)).toBe(false)
  })
})

describe('isCorrect', () => {
  it('빈 정답 배열(서술형)은 항상 false', () => {
    expect(isCorrect('아무 답', [])).toBe(false)
  })
})
