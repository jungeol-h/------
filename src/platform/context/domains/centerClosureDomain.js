// [Write] 센터 휴무기간 도메인 — 방학·임시휴무 등록/삭제 (2026-08 클라이언트 요청).
// 기간 내 자동 결석 판정 중단은 DB judge_attendance()가 수행한다
// (scripts/add-center-closures.sql). 여기서는 기간 CRUD와, 이미 잘못 생성된
// 자동 결석 기록·알림의 소급 정리만 담당한다.

import { useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'
import { toCenterClosure } from '../../lib/supabaseHelpers.js'
import { makeAdder, makeDeleter } from './crudKit.js'

const CLOSURE = { table: 'center_closures', collection: 'centerClosures' }

export function useCenterClosureDomain(setData) {
  const addCenterClosure = useMemo(() => makeAdder(setData, {
    ...CLOSURE, prefix: 'cls', toLocal: toCenterClosure, label: 'addCenterClosure',
    toRow: ({ startDate, endDate, label = '', createdBy = null }) => ({
      start_date: startDate,
      end_date: endDate,
      label,
      created_by: createdBy,
    }),
  }), [setData])

  const deleteCenterClosure = useMemo(
    () => makeDeleter(setData, { ...CLOSURE, label: 'deleteCenterClosure' }),
    [setData]
  )

  // 기간 내 자동 결석 기록·미등원 알림 소급 삭제.
  // 수동 정정(source='manual')·실제 등원 기록(check_in_at 존재)은 보존한다.
  // 반환: 삭제된 결석 기록 수.
  const purgeClosureAbsences = useCallback(async (startDate, endDate) => {
    const { data: removed, error } = await withWriteRetry(
      () => supabase.from('attendance_records')
        .delete()
        .gte('date', startDate).lte('date', endDate)
        .eq('source', 'auto')
        .is('check_in_at', null)
        .select('id'),
      { label: 'purgeClosureAbsences' }
    )
    if (error) throw error

    // 같은 기간의 미등원/자동결석 알림도 함께 정리 (실패해도 기록 삭제는 유지)
    const { error: notiError } = await withWriteRetry(
      () => supabase.from('attendance_notifications')
        .delete()
        .gte('date', startDate).lte('date', endDate)
        .in('type', ['no_show', 'auto_absent']),
      { label: 'purgeClosureAbsences.notifications' }
    )

    const removedIds = new Set((removed ?? []).map((r) => r.id))
    setData((prev) => ({
      ...prev,
      attendanceRecords: prev.attendanceRecords.filter((r) => !removedIds.has(r.id)),
      attendanceNotifications: notiError ? prev.attendanceNotifications
        : prev.attendanceNotifications.filter(
          (n) => !(n.date >= startDate && n.date <= endDate && ['no_show', 'auto_absent'].includes(n.type))
        ),
    }))
    return removedIds.size
  }, [setData])

  return { addCenterClosure, deleteCenterClosure, purgeClosureAbsences }
}
