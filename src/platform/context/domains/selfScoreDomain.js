// [Write] 일일 자기주도 학습 점수 도메인 — 학생 자기평가(0~100) + 메모.
// 하루 1건(UNIQUE student_id,date) — 재저장은 upsert로 덮어쓴다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toDailySelfScore } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

export function useSelfScoreDomain(setData) {
  const upsertDailySelfScore = useCallback(
    async (studentId, { date, score, memo = '' }) => {
      const row = {
        id: makeId('dss'),
        student_id: studentId,
        date,
        score,
        memo,
      }
      const { data: saved, error } = await withWriteRetry(
        () => supabase
          .from('daily_self_scores')
          .upsert(row, { onConflict: 'student_id,date' })
          .select()
          .single(),
        { label: 'upsertDailySelfScore' }
      )
      if (error) throw error
      const record = toDailySelfScore(saved ?? row)
      setData((prev) => ({
        ...prev,
        dailySelfScores: [
          record,
          ...prev.dailySelfScores.filter(
            (s) => !(s.studentId === studentId && s.date === date)
          ),
        ],
      }))
    },
    [setData]
  )

  return { upsertDailySelfScore }
}
