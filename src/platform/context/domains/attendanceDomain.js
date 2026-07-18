// [Write] 출결 도메인. 키오스크 등·하원 + 수동 정정 + 알림 확인.
//
// 시각 "판정"(지각/조퇴/결석)은 전부 DB에서 한다 — 키오스크 단말 시계를 믿지
// 않기 위해 등·하원은 RPC(kiosk_check_in/out)가 DB now() 기준으로 판정하고,
// 10분/30분 경과 판정은 pg_cron(judge_attendance)이 담당한다.
// 클라이언트는 입력과 표시만 한다. (supabase_attendance_migration.sql 참고)
//
// 시간표(attendance_schedules) 쓰기는 여기 없다 — 센터 이용시간의 파생물이라
// center_save_hours RPC가 저장 시 자동 갱신한다 (centerHours/README.md).

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import {
  toAttendanceRecord, toAttendanceNotification,
} from '../../lib/supabaseHelpers.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

export function useAttendanceDomain(setData) {
  // 키오스크 번호(전화번호 뒷 4자리) 매칭 — 로컬 상태를 건드리지 않는 조회
  const kioskFindStudents = useCallback(async (digits) => {
    const { data, error } = await supabase.rpc('kiosk_find_students', { p_digits: digits })
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      grade: row.grade ?? '',
      className: row.class_name ?? '',
      checkedIn: row.checked_in ?? false,
      checkedOut: row.checked_out ?? false,
    }))
  }, [])

  // RPC 결과의 record(jsonb)를 로컬 attendanceRecords에 반영
  const applyRecord = useCallback(
    (recordRow) => {
      if (!recordRow) return
      const record = toAttendanceRecord(recordRow)
      setData((prev) => ({
        ...prev,
        attendanceRecords: [
          record,
          ...prev.attendanceRecords.filter((r) => r.id !== record.id),
        ],
      }))
    },
    [setData]
  )

  // 등원 — DB가 지각 판정. { result: 'present'|'late'|'already_in', corrected, noSchedule }
  const kioskCheckIn = useCallback(
    async (studentId) => {
      const { data, error } = await withWriteRetry(
        () => supabase.rpc('kiosk_check_in', { p_student_id: studentId }),
        { label: 'kioskCheckIn' }
      )
      if (error) throw error
      applyRecord(data?.record)
      return {
        result: data?.result,
        corrected: data?.corrected ?? false,
        noSchedule: data?.no_schedule ?? false,
      }
    },
    [applyRecord]
  )

  // 하원 — DB가 조퇴 판정. { result: 'normal'|'early_leave'|'no_check_in' }
  const kioskCheckOut = useCallback(
    async (studentId) => {
      const { data, error } = await withWriteRetry(
        () => supabase.rpc('kiosk_check_out', { p_student_id: studentId }),
        { label: 'kioskCheckOut' }
      )
      if (error) throw error
      applyRecord(data?.record)
      return { result: data?.result }
    },
    [applyRecord]
  )

  // 매니저 수동 정정 (병결 처리 등) — patch: { status?, note?, checkoutStatus? }
  const updateAttendance = useCallback(
    async (recordId, patch) => {
      const snake = { source: 'manual' }
      if (patch.status !== undefined) snake.status = patch.status
      if (patch.note !== undefined) snake.note = patch.note
      if (patch.checkoutStatus !== undefined) snake.checkout_status = patch.checkoutStatus

      const { error } = await withWriteRetry(
        () => supabase.from('attendance_records').update(snake).eq('id', recordId),
        { label: 'updateAttendance' }
      )
      if (error) throw error

      setData((prev) => ({
        ...prev,
        attendanceRecords: prev.attendanceRecords.map((r) =>
          r.id === recordId ? { ...r, ...patch, source: 'manual' } : r
        ),
      }))
    },
    [setData]
  )

  // 긴급 알림 확인 처리
  const resolveAttendanceNotification = useCallback(
    async (notificationId) => {
      const { error } = await withWriteRetry(
        () => supabase.from('attendance_notifications')
          .update({ resolved: true }).eq('id', notificationId),
        { label: 'resolveAttendanceNotification' }
      )
      if (error) throw error

      setData((prev) => ({
        ...prev,
        attendanceNotifications: prev.attendanceNotifications.map((n) =>
          n.id === notificationId ? { ...n, resolved: true } : n
        ),
      }))
    },
    [setData]
  )

  // 긴급 알림 일괄 확인 — 시간표 일괄 반영 직후 등 알림이 수십 건 쌓였을 때
  const resolveAllAttendanceNotifications = useCallback(
    async (notificationIds) => {
      if (notificationIds.length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('attendance_notifications')
          .update({ resolved: true }).in('id', notificationIds),
        { label: 'resolveAllAttendanceNotifications' }
      )
      if (error) throw error

      const ids = new Set(notificationIds)
      setData((prev) => ({
        ...prev,
        attendanceNotifications: prev.attendanceNotifications.map((n) =>
          ids.has(n.id) ? { ...n, resolved: true } : n
        ),
      }))
    },
    [setData]
  )

  // Realtime INSERT 수신분을 로컬 상태에 주입 (중복 id는 무시)
  const ingestAttendanceNotification = useCallback(
    (row) => {
      const noti = toAttendanceNotification(row)
      setData((prev) => {
        if (prev.attendanceNotifications.some((n) => n.id === noti.id)) return prev
        return {
          ...prev,
          attendanceNotifications: [noti, ...prev.attendanceNotifications],
        }
      })
    },
    [setData]
  )

  return {
    kioskFindStudents,
    kioskCheckIn,
    kioskCheckOut,
    updateAttendance,
    resolveAttendanceNotification,
    resolveAllAttendanceNotifications,
    ingestAttendanceNotification,
  }
}
