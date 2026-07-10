// [Write] 상담 기록 도메인 CRUD.
//
// 매니저/관리자가 학생 상담을 직접 작성·누적한다. counseling_records.manager_id는
// 작성자(매니저 또는 관리자) 본인의 user id로 해석한다 — FK는 users(id)라 관리자
// 작성도 문제없고, 변환기 toCounselingRecord가 educatorId로 매핑한다.
//
// 홈탭의 마인드 위험 코칭(alertDomain.recordCoaching)과 별개로 공존하며,
// 두 경로 모두 counseling_records에 누적된다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toCounselingRecord } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

export function useCounselingDomain(setData) {
  const addCounselingRecord = useCallback(
    async ({ studentId, authorId, content, type, targetType }) => {
      const row = {
        id: makeId('c'),
        student_id: studentId,
        manager_id: authorId,
        date: new Date().toISOString().slice(0, 10),
        content,
        type,
        target_type: targetType ?? 'student',
      }
      const { error } = await withWriteRetry(
        () => supabase.from('counseling_records').insert(row),
        { label: 'addCounselingRecord' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        counselingRecords: [toCounselingRecord(row), ...prev.counselingRecords],
      }))
    },
    [setData]
  )

  // 상담 기록 수정 — 앱 모델 content는 DB의 content 컬럼(변환기에서 comment로 매핑)이다.
  const updateCounselingRecord = useCallback(
    async (id, { content, type, targetType }) => {
      const snake = {}
      if (content !== undefined) snake.content = content
      if (type !== undefined) snake.type = type
      if (targetType !== undefined) snake.target_type = targetType
      if (Object.keys(snake).length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('counseling_records').update(snake).eq('id', id),
        { label: 'updateCounselingRecord' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        counselingRecords: prev.counselingRecords.map((r) =>
          r.id === id
            ? {
                ...r,
                ...(content !== undefined ? { comment: content } : {}),
                ...(type !== undefined ? { type } : {}),
                ...(targetType !== undefined ? { targetType } : {}),
              }
            : r
        ),
      }))
    },
    [setData]
  )

  // 상담 기록 삭제.
  // 주의: alertDomain.recordCoaching이 만든 type='mind' 기록을 삭제해도 alerts.coaching_comment는 남는다(의도된 비동기화).
  const deleteCounselingRecord = useCallback(
    async (id) => {
      const { error } = await withWriteRetry(
        () => supabase.from('counseling_records').delete().eq('id', id),
        { label: 'deleteCounselingRecord' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        counselingRecords: prev.counselingRecords.filter((r) => r.id !== id),
      }))
    },
    [setData]
  )

  return { addCounselingRecord, updateCounselingRecord, deleteCounselingRecord }
}
