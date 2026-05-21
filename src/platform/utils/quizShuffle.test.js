import { describe, it, expect } from 'vitest'
import { shuffleQuestionsOrder } from './quizShuffle.js'

const sample = [
  { id: 'q1', orderNo: 1, question: 'A?', acceptedAnswers: ['a'], explanation: 'e1', hint: 'h1' },
  { id: 'q2', orderNo: 2, question: 'B?', acceptedAnswers: ['b1', 'b2'], explanation: '', hint: '' },
  { id: 'q3', orderNo: 3, question: 'C?', acceptedAnswers: ['c'], explanation: 'e3', hint: 'h3' },
  { id: 'q4', orderNo: 4, question: 'D?', acceptedAnswers: ['d'], explanation: '', hint: '' },
  { id: 'q5', orderNo: 5, question: 'E?', acceptedAnswers: ['e'], explanation: 'e5', hint: '' },
]

describe('shuffleQuestionsOrder', () => {
  it('보존: 개수와 본문/정답/해설/힌트는 그대로', () => {
    const out = shuffleQuestionsOrder(sample)
    expect(out).toHaveLength(sample.length)
    // 같은 id 집합
    expect(new Set(out.map((q) => q.id))).toEqual(new Set(sample.map((q) => q.id)))
    // id별 본문 매칭이 일치
    const byId = Object.fromEntries(sample.map((q) => [q.id, q]))
    for (const q of out) {
      const src = byId[q.id]
      expect(q.question).toBe(src.question)
      expect(q.acceptedAnswers).toEqual(src.acceptedAnswers)
      expect(q.explanation).toBe(src.explanation)
      expect(q.hint).toBe(src.hint)
    }
  })

  it('orderNo는 1..N 순열', () => {
    const out = shuffleQuestionsOrder(sample)
    const orders = out.map((q) => q.orderNo).sort((a, b) => a - b)
    expect(orders).toEqual([1, 2, 3, 4, 5])
  })

  it('rng 주입으로 결정론적 결과 — 동일 rng는 동일 순서', () => {
    // 0.5 고정 rng — Fisher-Yates에서 i=N..1, j=floor(0.5*(i+1)) 패턴
    const fixed = () => 0.5
    const a = shuffleQuestionsOrder(sample, fixed)
    const b = shuffleQuestionsOrder(sample, fixed)
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id))
  })

  it('원본 배열을 변경하지 않음', () => {
    const snapshot = JSON.parse(JSON.stringify(sample))
    shuffleQuestionsOrder(sample)
    expect(sample).toEqual(snapshot)
  })

  it('빈 배열 처리', () => {
    expect(shuffleQuestionsOrder([])).toEqual([])
  })

  it('단일 문제는 orderNo=1로 정규화', () => {
    const out = shuffleQuestionsOrder([{ id: 'q1', orderNo: 99, question: 'X?', acceptedAnswers: ['x'] }])
    expect(out).toHaveLength(1)
    expect(out[0].orderNo).toBe(1)
    expect(out[0].id).toBe('q1')
  })
})
