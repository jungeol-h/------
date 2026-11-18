import { describe, it, expect } from 'vitest'
import {
  normalizeNaviReview, hasNaviReviewContent, pickableEducators,
  filterNaviReviewsByRole, groupNaviReviewsByEducator,
} from './naviReview.js'

describe('normalizeNaviReview / hasNaviReviewContent', () => {
  it('빈 강사 후기·중복 강사를 걸러내고 공백을 다듬는다', () => {
    const n = normalizeNaviReview({
      instructorReviews: [
        { educatorId: 'a', educatorName: 'A', content: '  좋아요 ' },
        { educatorId: 'a', educatorName: 'A', content: '중복' },
        { educatorId: 'b', educatorName: 'B', content: '   ' },
      ],
      toDirector: ' 감사합니다 ',
    })
    expect(n.instructorReviews).toEqual([{ educatorId: 'a', educatorName: 'A', content: '좋아요' }])
    expect(n.toDirector).toBe('감사합니다')
    expect(n.mostRegret).toBe('')
  })

  it('전부 비어 있으면 제출 불가, 한 칸이라도 있으면 가능', () => {
    expect(hasNaviReviewContent({})).toBe(false)
    expect(hasNaviReviewContent({ toSelf: '  ' })).toBe(false)
    expect(hasNaviReviewContent({ mostHelpful: '멘토링' })).toBe(true)
    expect(hasNaviReviewContent({ instructorReviews: [{ educatorId: 'a', content: 'x' }] })).toBe(true)
  })
})

describe('pickableEducators', () => {
  it('강사·컨설턴트만, 본인·비활성 제외, 이름순', () => {
    const users = [
      { id: '1', name: '다', role: 'instructor' },
      { id: '2', name: '가', role: 'consultant', status: 'active' },
      { id: '3', name: '나', role: 'instructor', status: 'inactive' },
      { id: '4', name: '라', role: 'admin' },
      { id: '5', name: '마', role: 'instructor' },
    ]
    expect(pickableEducators(users, '5').map((u) => u.id)).toEqual(['2', '1'])
  })
})

describe('관리자 열람 로직', () => {
  const reviews = [
    { id: 'r1', authorRole: 'student', authorName: '학생1', updatedAt: 't1',
      instructorReviews: [{ educatorId: 'e1', educatorName: '김강사', content: '친절' }] },
    { id: 'r2', authorRole: 'consultant', authorName: '컨설턴트1', updatedAt: 't2',
      instructorReviews: [
        { educatorId: 'e1', educatorName: '김강사', content: '열정' },
        { educatorId: 'e2', educatorName: '박강사', content: '  ' },
      ] },
    { id: 'r3', authorRole: 'parent', authorName: '학부모1', updatedAt: 't3', instructorReviews: [] },
  ]

  it('역할 필터: 강사는 instructor+consultant', () => {
    expect(filterNaviReviewsByRole(reviews, 'educator').map((r) => r.id)).toEqual(['r2'])
    expect(filterNaviReviewsByRole(reviews, 'parent').map((r) => r.id)).toEqual(['r3'])
    expect(filterNaviReviewsByRole(reviews, 'all')).toHaveLength(3)
  })

  it('강사별 모아보기: id 기준 병합, 빈 내용 제외', () => {
    const g = groupNaviReviewsByEducator(reviews)
    expect(g).toHaveLength(1)
    expect(g[0].educatorId).toBe('e1')
    expect(g[0].items.map((i) => i.authorName)).toEqual(['학생1', '컨설턴트1'])
  })
})
