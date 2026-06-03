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
    async ({ studentId, authorId, content, type }) => {
      const row = {
        id: makeId('c'),
        student_id: studentId,
        manager_id: authorId,
        date: new Date().toISOString().slice(0, 10),
        content,
        type,
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

  return { addCounselingRecord }
}
