import { describe, it, expect } from 'vitest'
import {
  learningTimeScore,
  selfEvalScore,
  dailySelfDirectedScore,
  getSelfDirectedIndex,
  getEmotionStability,
} from './indices.js'

describe('learningTimeScore — docs 학생.md 구간표', () => {
  it('4시간(240분) 이상이면 10점', () => {
    expect(learningTimeScore(240)).toBe(10)
    expect(learningTimeScore(300)).toBe(10)
  })
  it('3시간 초과~3시간30분은 9점', () => {
    expect(learningTimeScore(181)).toBe(9)
    expect(learningTimeScore(211)).toBe(9)
  })
  it('2시간 초과~2시간30분은 5점', () => {
    expect(learningTimeScore(121)).toBe(5)
    expect(learningTimeScore(150)).toBe(5)
  })
  it('1시간(60분) 경계: 60분 이상은 1점, 미만은 0점', () => {
    expect(learningTimeScore(60)).toBe(1)
    expect(learningTimeScore(59)).toBe(0)
    expect(learningTimeScore(0)).toBe(0)
  })
})

describe('selfEvalScore — 집중도 10점 환산', () => {
  it('기록 없으면 0점', () => {
    expect(selfEvalScore([])).toBe(0)
  })
  it('집중도 100%면 10점', () => {
    expect(selfEvalScore([{ focus: 100 }])).toBe(10)
  })
  it('여러 기록은 평균 집중도로 환산', () => {
    expect(selfEvalScore([{ focus: 80 }, { focus: 60 }])).toBe(7)
  })
})

describe('dailySelfDirectedScore — 하루 점수(0~20)', () => {
  it('학습시간 점수 + 자가평가 점수', () => {
    // 240분(10점) + 집중도 100%(10점) = 20점
    expect(
      dailySelfDirectedScore([{ duration: 240, focus: 100 }])
    ).toBe(20)
  })
})

describe('getSelfDirectedIndex — 자기주도지수(0~100)', () => {
  it('학습기록 없으면 null', () => {
    expect(getSelfDirectedIndex({ learningRecords: [] }, 's1')).toBeNull()
  })
  it('만점 하루 = 100점 (20점 만점 백분위)', () => {
    const data = {
      learningRecords: [
        { studentId: 's1', date: '2026-05-16', duration: 240, focus: 100 },
      ],
    }
    expect(getSelfDirectedIndex(data, 's1')).toBe(100)
  })
  it('여러 날은 일평균으로 산출', () => {
    const data = {
      learningRecords: [
        // day1: 240분(10) + focus100(10) = 20
        { studentId: 's1', date: '2026-05-15', duration: 240, focus: 100 },
        // day2: 0분(0) + focus0(0) = 0
        { studentId: 's1', date: '2026-05-16', duration: 30, focus: 0 },
      ],
    }
    // 평균 10/20 → 50점
    expect(getSelfDirectedIndex(data, 's1')).toBe(50)
  })
  it('다른 학생 기록은 섞이지 않는다', () => {
    const data = {
      learningRecords: [
        { studentId: 's2', date: '2026-05-16', duration: 240, focus: 100 },
      ],
    }
    expect(getSelfDirectedIndex(data, 's1')).toBeNull()
  })
})

describe('getEmotionStability — 정서 안정도(0~100)', () => {
  it('마인드 기록 없으면 null', () => {
    expect(getEmotionStability({ mindRecords: [] }, 's1')).toBeNull()
  })
  it('합산 0(중립)이면 50점', () => {
    const data = {
      mindRecords: [
        { studentId: 's1', mood: 0, motivation: 0, confidence: 0 },
      ],
    }
    expect(getEmotionStability(data, 's1')).toBe(50)
  })
  it('최고점(합산 +15)이면 100점', () => {
    const data = {
      mindRecords: [
        { studentId: 's1', mood: 5, motivation: 5, confidence: 5 },
      ],
    }
    expect(getEmotionStability(data, 's1')).toBe(100)
  })
  it('최저점(합산 -15)이면 0점', () => {
    const data = {
      mindRecords: [
        { studentId: 's1', mood: -5, motivation: -5, confidence: -5 },
      ],
    }
    expect(getEmotionStability(data, 's1')).toBe(0)
  })
})
