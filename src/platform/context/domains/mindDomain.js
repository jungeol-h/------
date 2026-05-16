// [Write] 마인드 도메인 CRUD — 마인드 입력만 담당하는 순수 CRUD.
//
// 위험 알림은 여기서 만들지 않는다. 마인드 점수 기반 위험 "탐지"는
// selectors/riskDetection.js 가 조회 시점에 계산한다 (관제탑형).

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toMindRecord } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'

export function useMindDomain(setData) {
  const addMindRecord = useCallback(
    async (studentId, { mood, motivation, confidence, memo }) => {
      const date = new Date().toISOString().slice(0, 10)
      const row = {
        id: makeId('m'),
        student_id: studentId,
        date,
        mood,
        motivation,
        confidence,
        memo,
      }

      const { error } = await supabase.from('mind_records').insert(row)
      if (error) {
        console.error('addMindRecord insert error:', error)
        throw error
      }

      setData((prev) => ({
        ...prev,
        mindRecords: [toMindRecord(row), ...prev.mindRecords],
      }))
    },
    [setData]
  )

  return { addMindRecord }
}
