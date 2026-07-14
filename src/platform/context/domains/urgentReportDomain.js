// [Write] 긴급 보고·건의 도메인 — 강사/컨설턴트 → 관리자 직보고 (인앱).

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toUrgentReport } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

export function useUrgentReportDomain(setData) {
  const addUrgentReport = useCallback(
    async ({ authorId, content, groupName = null }) => {
      const row = {
        id: makeId('ur'),
        author_id: authorId,
        content,
        confirmed: false,
        group_name: groupName || null, // 작성자 소속 자동 태그 — null = 공용
      }
      const { error } = await withWriteRetry(
        () => supabase.from('urgent_reports').insert(row),
        { label: 'addUrgentReport' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        urgentReports: [toUrgentReport({ ...row, created_at: new Date().toISOString() }), ...prev.urgentReports],
      }))
    },
    [setData]
  )

  // 관리자 확인(읽음) 처리
  const confirmUrgentReport = useCallback(
    async (id, adminId) => {
      const confirmedAt = new Date().toISOString()
      const { error } = await withWriteRetry(
        () => supabase
          .from('urgent_reports')
          .update({ confirmed: true, confirmed_by: adminId, confirmed_at: confirmedAt })
          .eq('id', id),
        { label: 'confirmUrgentReport' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        urgentReports: prev.urgentReports.map((r) =>
          r.id === id ? { ...r, confirmed: true, confirmedBy: adminId, confirmedAt } : r
        ),
      }))
    },
    [setData]
  )

  return { addUrgentReport, confirmUrgentReport }
}
