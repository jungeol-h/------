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
import { makeId } from '../dataModel.js'

export function useAttendanceDomain(setData) {
  // 키오스크 번호(전화번호 뒷 4자리) 매칭 — 로컬 상태를 건드리지 않는 조회
  // checkedIn: 현재 등원 중(하원 안 함). checkedOut: 오늘 하원 이력 있음(재등원 가능 상태).
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

  // 교직원 키오스크 번호(전화번호 뒷 4자리) 매칭 — 학생과 완전히 분리된
  // staff_attendance_records 조회. role: admin/manager/instructor/consultant.
  // 로컬 data 컬렉션에 안 실리므로 setData 동기화 없음(scripts/add-staff-attendance.sql).
  const kioskFindStaff = useCallback(async (digits) => {
    const { data, error } = await supabase.rpc('kiosk_find_staff', { p_digits: digits })
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      checkedIn: row.checked_in ?? false,
      checkedOut: row.checked_out ?? false,
    }))
  }, [])

  // 교직원 출근 — 시간표/지각 판정 없는 순수 기록. { result: 'ok'|'already_in', reentry }
  const kioskStaffCheckIn = useCallback(async (staffId) => {
    const { data, error } = await withWriteRetry(
      () => supabase.rpc('kiosk_staff_check_in', { p_staff_id: staffId }),
      { label: 'kioskStaffCheckIn' }
    )
    if (error) throw error
    return { result: data?.result, reentry: data?.reentry ?? false }
  }, [])

  // 교직원 퇴근. { result: 'ok'|'no_check_in' }
  const kioskStaffCheckOut = useCallback(async (staffId) => {
    const { data, error } = await withWriteRetry(
      () => supabase.rpc('kiosk_staff_check_out', { p_staff_id: staffId }),
      { label: 'kioskStaffCheckOut' }
    )
    if (error) throw error
    return { result: data?.result }
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

  // 등원 — DB가 지각 판정. { result: 'present'|'late'|'already_in', corrected, noSchedule, reentry }
  // reentry: 하원 완료 후 재등원(하루 2회 이상 등원)인 경우 true
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
        reentry: data?.reentry ?? false,
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

  // 수동 출결 기록 생성 — 기록이 아직 없는 미등원(no_show) 학생에게 결석 사유를
  // 남길 때 사용 (2026-08 클라이언트: 긴급확인 → 사유 입력 연결). cron이 30분 후
  // auto 결석을 만들려 해도 UNIQUE(student_id, date) + ON CONFLICT DO NOTHING이라
  // 이 수동 기록이 유지된다. 이미 기록이 있으면(23505) 명확한 에러로 안내.
  const createManualAttendance = useCallback(
    async (studentId, date, { status = 'absent', note = '' } = {}) => {
      const row = {
        id: makeId('at-'),
        student_id: studentId,
        date,
        status,
        note,
        source: 'manual',
      }
      const { error } = await withWriteRetry(
        () => supabase.from('attendance_records').insert(row),
        { label: 'createManualAttendance' }
      )
      if (error) {
        if (error.code === '23505') {
          throw new Error('해당 날짜에 이미 출결 기록이 있습니다. 새로고침 후 정정으로 수정해 주세요.')
        }
        throw error
      }
      const local = toAttendanceRecord({ ...row, created_at: new Date().toISOString() })
      setData((prev) => ({
        ...prev,
        attendanceRecords: [local, ...prev.attendanceRecords],
      }))
      return local
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
    kioskFindStaff,
    kioskStaffCheckIn,
    kioskStaffCheckOut,
    updateAttendance,
    createManualAttendance,
    resolveAttendanceNotification,
    resolveAllAttendanceNotifications,
    ingestAttendanceNotification,
  }
}
