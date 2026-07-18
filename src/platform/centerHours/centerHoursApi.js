// 센터 이용시간 등록 — 데이터 접근 계층.
// booking/ 격리 원칙 승계: DataContext·fetchers·supabaseHelpers를 건드리지 않고
// 화면이 마운트 시 직접 fetch한다. 쓰기는 전부 SECURITY DEFINER RPC 경유
// (scripts/add-center-hours.sql). 설정은 admin_config('center_hours') 한 행.

import { supabase } from '../lib/supabase.js'
import { CENTER_CAPACITY_DEFAULT } from '../data/centerHours.js'

const toRegistration = (row) => ({
  id: row.id,
  studentId: row.student_id,
  dayOfWeek: row.day_of_week,
  startTime: String(row.start_time ?? '').slice(0, 5), // TIME 'HH:MM:SS' → 'HH:MM'
  endTime: String(row.end_time ?? '').slice(0, 5),
})

// 마이그레이션 미적용(테이블 없음) 판별 — 화면은 안내 카드만 띄운다
export const isMigrationMissing = (error) =>
  error?.code === '42P01' || /does not exist/i.test(error?.message ?? '')

export async function fetchCenterHours() {
  const [regRes, cfgRes] = await Promise.all([
    supabase
      .from('center_hour_registrations')
      .select('id, student_id, day_of_week, start_time, end_time'),
    supabase.from('admin_config').select('value').eq('key', 'center_hours').maybeSingle(),
  ])
  if (regRes.error) throw regRes.error
  if (cfgRes.error) throw cfgRes.error
  return {
    registrations: (regRes.data ?? []).map(toRegistration),
    config: {
      isOpen: cfgRes.data?.value?.isOpen ?? false,
      capacity: cfgRes.data?.value?.capacity ?? CENTER_CAPACITY_DEFAULT,
    },
  }
}

// 한 학생의 등록 전체 교체. entries = [{ day, start, end }]
// 반환: { ok:true } | { ok:false, code:'LOCKED'|'SLOT_FULL'|..., full?:[{day,start}] }
export async function saveCenterHours({ studentId, actorRole, entries }) {
  const { data, error } = await supabase.rpc('center_save_hours', {
    p_student_id: studentId,
    p_actor_role: actorRole,
    p_entries: entries,
  })
  if (error) throw error
  return data
}

// 설정 병합 저장 (관리자 전용 화면에서만 호출)
export async function updateCenterHoursConfig(patch) {
  const { data: row, error: readError } = await supabase
    .from('admin_config').select('value').eq('key', 'center_hours').maybeSingle()
  if (readError) throw readError
  const next = { isOpen: false, capacity: CENTER_CAPACITY_DEFAULT, ...row?.value, ...patch }
  const { error } = await supabase
    .from('admin_config')
    .upsert({ key: 'center_hours', value: next }, { onConflict: 'key' })
  if (error) throw error
  return next
}

// 등·하원 시간표 일괄 반영. 반환: { ok:true, students } | { ok:false, code }
export async function syncAttendanceSchedules(actorRole) {
  const { data, error } = await supabase.rpc('center_sync_attendance_schedules', {
    p_actor_role: actorRole,
  })
  if (error) throw error
  return data
}
