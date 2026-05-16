import { describe, it, expect } from 'vitest'
import { getReconciliationIssues } from './reconciliation.js'

describe('getReconciliationIssues — 시스템 정합성 점검', () => {
  it('이상 없으면 hasIssue=false, 모든 목록 비어있음', () => {
    const data = {
      students: [{ id: 's1', status: 'active' }],
      educators: [{ id: 'e1' }],
      assignments: [{ studentId: 's1', educatorId: 'e1' }],
      _fetchErrors: [],
      _fetchMeta: {},
    }
    const r = getReconciliationIssues(data)
    expect(r.hasIssue).toBe(false)
    expect(r.unassignedActive).toEqual([])
    expect(r.orphanAssignments).toEqual([])
    expect(r.truncatedTables).toEqual([])
    expect(r.fetchErrors).toEqual([])
  })

  it('active인데 배정 없는 학생을 unassignedActive로 탐지', () => {
    const data = {
      students: [
        { id: 's1', status: 'active' }, // 배정됨
        { id: 's2', status: 'active' }, // 미배정 — 침묵 실패 후보
      ],
      educators: [{ id: 'e1' }],
      assignments: [{ studentId: 's1', educatorId: 'e1' }],
      _fetchErrors: [],
      _fetchMeta: {},
    }
    const r = getReconciliationIssues(data)
    expect(r.hasIssue).toBe(true)
    expect(r.unassignedActive.map((s) => s.id)).toEqual(['s2'])
  })

  it('비활성 학생은 미배정이어도 무시', () => {
    const data = {
      students: [{ id: 's1', status: 'inactive' }],
      educators: [],
      assignments: [],
      _fetchErrors: [],
      _fetchMeta: {},
    }
    const r = getReconciliationIssues(data)
    expect(r.unassignedActive).toEqual([])
    expect(r.hasIssue).toBe(false)
  })

  it('status 누락 시 active로 간주 → 미배정이면 탐지', () => {
    const data = {
      students: [{ id: 's1' }],
      educators: [],
      assignments: [],
      _fetchErrors: [],
      _fetchMeta: {},
    }
    expect(getReconciliationIssues(data).unassignedActive.map((s) => s.id)).toEqual(['s1'])
  })

  it('가리키는 학생/교육자가 없는 배정을 orphan으로 탐지', () => {
    const data = {
      students: [{ id: 's1', status: 'active' }],
      educators: [{ id: 'e1' }],
      assignments: [
        { studentId: 's1', educatorId: 'e1' },     // 정상
        { studentId: 's1', educatorId: 'e_gone' },  // 교육자 없음
        { studentId: 's_gone', educatorId: 'e1' },  // 학생 없음
      ],
      _fetchErrors: [],
      _fetchMeta: {},
    }
    const r = getReconciliationIssues(data)
    expect(r.orphanAssignments).toHaveLength(2)
    expect(r.hasIssue).toBe(true)
  })

  it('_fetchMeta에서 fetched < total이면 truncatedTables로 탐지', () => {
    const data = {
      students: [],
      educators: [],
      assignments: [],
      _fetchErrors: [],
      _fetchMeta: {
        mind_records: { fetched: 2000, total: 2500 },   // 잘림
        learning_records: { fetched: 100, total: 100 }, // 정상
      },
    }
    const r = getReconciliationIssues(data)
    expect(r.truncatedTables).toEqual([
      { table: 'mind_records', fetched: 2000, total: 2500 },
    ])
    expect(r.hasIssue).toBe(true)
  })

  it('_fetchErrors가 있으면 그대로 노출하고 hasIssue=true', () => {
    const data = {
      students: [],
      educators: [],
      assignments: [],
      _fetchErrors: [{ table: 'mind_records', message: 'network error' }],
      _fetchMeta: {},
    }
    const r = getReconciliationIssues(data)
    expect(r.fetchErrors).toHaveLength(1)
    expect(r.hasIssue).toBe(true)
  })

  it('메타 필드 누락(구버전 data)에도 안전하게 동작', () => {
    const data = { students: [], educators: [], assignments: [] }
    const r = getReconciliationIssues(data)
    expect(r.hasIssue).toBe(false)
    expect(r.truncatedTables).toEqual([])
    expect(r.fetchErrors).toEqual([])
  })
})
