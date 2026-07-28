import { describe, it, expect } from 'vitest'
import { filterUnreferencedPaths } from './counselingFiles.js'

// fan-out으로 생성된 상담기록들이 같은 첨부 실파일(path)을 공유하므로,
// 삭제 전 다른 기록이 참조하는 path를 걸러내는 가드를 검증한다.
describe('filterUnreferencedPaths', () => {
  const records = [
    { id: 'c1', attachments: [{ path: 'a/shared.pdf' }, { path: 'a/own1.pdf' }] },
    { id: 'c2', attachments: [{ path: 'a/shared.pdf' }] },
    { id: 'c3', attachments: [] },
    { id: 'c4' }, // attachments 없음
  ]

  it('형제 기록이 참조하는 path는 제외하고 미참조 path만 남긴다', () => {
    expect(filterUnreferencedPaths(['a/shared.pdf', 'a/own1.pdf'], records, 'c1'))
      .toEqual(['a/own1.pdf']) // shared는 c2가 참조 중
  })

  it('마지막 참조 기록을 지울 때는 실파일도 삭제 대상이 된다', () => {
    const afterC1Deleted = records.filter((r) => r.id !== 'c1')
    expect(filterUnreferencedPaths(['a/shared.pdf'], afterC1Deleted, 'c2'))
      .toEqual(['a/shared.pdf'])
  })

  it('빈 입력·기록 없음도 안전', () => {
    expect(filterUnreferencedPaths([], records, 'c1')).toEqual([])
    expect(filterUnreferencedPaths(undefined, records, 'c1')).toEqual([])
    expect(filterUnreferencedPaths(['a/x.pdf'], undefined, 'c1')).toEqual(['a/x.pdf'])
  })
})
