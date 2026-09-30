// 상담보고·수업보고 저장 직후, 같은 학생·같은 날짜의 출결 미처리 예약을 참석으로
// 자동 반영한다 (2026-09-30 클라이언트: 기록을 쓰면 출결이 자동 처리되게).
//
// 판정은 전부 DB(booking_sync_attendance_from_records — add-booking-auto-attendance.sql)가
// 기록 존재를 다시 확인해 수행한다: 작성자가 슬롯 강사 본인인 확정·미처리 예약만.
// 야간 일괄(booking_auto_attendance)이 같은 규칙으로 다시 훑으므로 여기서는
// best-effort — 실패해도 기록 저장을 막지 않는다 (studentDomain의 예약 일괄 취소와 같은 관례).

import { supabase } from '../../lib/supabase.js'
import { reportError } from '../../lib/sentry.js'

export async function syncBookingAttendance({ studentIds, date, actorId = null }) {
  const ids = (studentIds ?? []).filter(Boolean)
  if (ids.length === 0 || !date) return
  try {
    const { error } = await supabase.rpc('booking_sync_attendance_from_records', {
      p_student_ids: ids, p_date: date, p_actor_id: actorId,
    })
    if (error) throw error
  } catch (err) {
    reportError(err, { where: 'syncBookingAttendance', date })
  }
}
