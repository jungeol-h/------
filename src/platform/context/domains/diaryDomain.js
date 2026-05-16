// [Write] 3줄 일기 도메인 CRUD.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toDiaryRecord } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { reportError } from '../../lib/sentry.js'

export function useDiaryDomain(data, setData) {
  // 오늘 날짜 일기가 있으면 덮어쓰기(upsert), 없으면 신규.
  const addDiaryRecord = useCallback(
    async (studentId, { praise, reflection, resolution }) => {
      const date = new Date().toISOString().slice(0, 10)
      const existing = data.diaryRecords.find(
        (d) => d.studentId === studentId && d.date === date
      )
      const id = existing?.id ?? makeId('d')
      const row = { id, student_id: studentId, date, praise, reflection, resolution }

      const { error } = await supabase
        .from('diary_records')
        .upsert(row, { onConflict: 'student_id,date' })
      if (error) {
        reportError(error, { where: 'addDiaryRecord', studentId })
        throw error
      }

      const local = toDiaryRecord(row)
      setData((prev) => ({
        ...prev,
        diaryRecords: existing
          ? prev.diaryRecords.map((d) => (d.id === existing.id ? local : d))
          : [local, ...prev.diaryRecords],
      }))
    },
    [data.diaryRecords, setData]
  )

  return { addDiaryRecord }
}
