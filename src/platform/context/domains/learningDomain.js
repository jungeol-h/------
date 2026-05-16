// [Write] 학습 기록 도메인 CRUD.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toLearningRecord } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'

export function useLearningDomain(setData) {
  const addLearningRecord = useCallback(
    async (studentId, { subject, duration, focus }) => {
      const row = {
        id: makeId('l'),
        student_id: studentId,
        date: new Date().toISOString().slice(0, 10),
        subject,
        duration,
        focus,
      }
      const { error } = await supabase.from('learning_records').insert(row)
      if (error) {
        console.error('addLearningRecord insert error:', error)
        throw error
      }
      setData((prev) => ({
        ...prev,
        learningRecords: [toLearningRecord(row), ...prev.learningRecords],
      }))
    },
    [setData]
  )

  return { addLearningRecord }
}
