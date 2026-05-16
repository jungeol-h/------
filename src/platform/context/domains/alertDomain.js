// [Write] 코칭 기록 도메인. alerts 테이블 = "매니저가 위험 학생에게 코칭한 건".
//
// 위험 "탐지"는 selectors/riskDetection.js 가 담당하고, 여기서는 매니저가 위험
// 학생을 보고 코칭했을 때 그 "조치"를 기록한다. 행위 주체가 항상 매니저이므로
// manager_id는 매니저 본인 ID — alerts.manager_id NOT NULL 제약과 자연히 맞는다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toAlert, toCounselingRecord } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'

export function useAlertDomain(setData) {
  // 매니저가 위험 학생에게 코칭 → 코칭 기록(alert) + 상담 기록(counseling) 생성.
  // managerId는 코칭하는 매니저 본인. level은 riskDetection 판정값('warning'|'danger').
  const recordCoaching = useCallback(
    async ({ studentId, managerId, studentName, level, comment }) => {
      const date = new Date().toISOString().slice(0, 10)

      const alertRow = {
        id: makeId('al'),
        student_id: studentId,
        manager_id: managerId,
        type: 'mind',
        severity: level ?? 'warning',
        message: `${studentName ?? ''} 학생 마인드 코칭`,
        detail: comment,
        date,
        resolved: true,
        coaching_comment: comment,
      }
      const { error: alertError } = await supabase.from('alerts').insert(alertRow)
      if (alertError) {
        console.error('recordCoaching alert insert error:', alertError)
        throw alertError
      }

      const counselRow = {
        id: makeId('c'),
        student_id: studentId,
        manager_id: managerId,
        date,
        content: comment,
        type: 'mind',
      }
      const { error: counselError } = await supabase
        .from('counseling_records')
        .insert(counselRow)
      if (counselError) {
        console.error('recordCoaching counseling insert error:', counselError)
        throw counselError
      }

      setData((prev) => ({
        ...prev,
        alerts: [toAlert(alertRow), ...prev.alerts],
        counselingRecords: [toCounselingRecord(counselRow), ...prev.counselingRecords],
      }))
    },
    [setData]
  )

  return { recordCoaching }
}
