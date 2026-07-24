// 예약 시스템 전용 데이터 접근 계층 (external/externalData.js 선례의 격리 원칙).
//
// - DataContext/fetchers/supabaseHelpers는 건드리지 않는다. snake↔camel 변환은
//   이 모듈 전용 로컬 함수, 누락 컬럼은 `?? 기본값`으로 마이그레이션 미적용에 내성.
// - 정원·겹침·횟수·기한의 최종 검증은 전부 SECURITY DEFINER RPC 안이다.
//   여기의 rpc 래퍼는 { ok, code, ... } jsonb를 그대로 반환한다 — code는
//   bookingMessages.js 안내문 키와 1:1.
// - 모든 쓰기는 withWriteRetry 경유 (규약).

import { supabase } from '../lib/supabase.js'
import { withWriteRetry } from '../lib/supabaseRetry.js'
import { makeId } from '../context/dataModel.js'

const toHHMM = (t) => (t ? String(t).slice(0, 5) : '')

// ─── 로컬 변환 ─────────────────────────────────────────────────

export function toBookingProgram(row) {
  return {
    id: row.id,
    name: row.name,
    slotMinutes: row.slot_minutes ?? 20,
    defaultCapacity: row.default_capacity ?? 1,
    dailyLimit: row.daily_limit ?? 1,
    dailyLimitScope: row.daily_limit_scope ?? 'program',
    allowConsecutive: row.allow_consecutive ?? true,
    allowGroup: row.allow_group ?? false,
    groupMin: row.group_min ?? 3,
    groupMax: row.group_max ?? 4,
    usesSubject: row.uses_subject ?? false,
    requiresOpenPeriod: row.requires_open_period ?? false,
    changeDeadlineType: row.change_deadline_type ?? 'minutes_before',
    changeDeadlineValue: row.change_deadline_value ?? 60,
    bookingOpenLeadMinutes: row.booking_open_lead_minutes ?? 60,
    bookingCloseLeadMinutes: row.booking_close_lead_minutes ?? 60,
    targetGroupNames: row.target_group_names ?? [],
    active: row.active ?? true,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
  }
}

export function toBookingSubject(row) {
  return {
    id: row.id,
    programId: row.program_id,
    name: row.name,
    active: row.active ?? true,
    sortOrder: row.sort_order ?? 0,
  }
}

export function toBookingEducator(row) {
  return {
    id: row.id,
    programId: row.program_id,
    educatorId: row.educator_id,
    subjectId: row.subject_id ?? null,
    active: row.active ?? true,
  }
}

export function toBookingOpenPeriod(row) {
  return {
    id: row.id,
    programId: row.program_id,
    targetStart: row.target_start,
    targetEnd: row.target_end,
    openFrom: row.open_from,
    openUntil: row.open_until,
    note: row.note ?? '',
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
  }
}

export function toBookingSlot(row) {
  return {
    id: row.id,
    programId: row.program_id,
    educatorId: row.educator_id ?? null,
    subjectId: row.subject_id ?? null,
    batchId: row.batch_id ?? null,
    date: row.date,
    startTime: toHHMM(row.start_time),
    endTime: toHHMM(row.end_time),
    capacity: row.capacity ?? 1,
    status: row.status ?? 'draft',
    isPublic: row.is_public ?? true,
    note: row.note ?? '',
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
  }
}

export function toBookingReservation(row) {
  return {
    id: row.id,
    slotId: row.slot_id,
    programId: row.program_id,
    studentId: row.student_id,
    bookedBy: row.booked_by,
    bookedByRole: row.booked_by_role,
    status: row.status ?? 'confirmed',
    movedToId: row.moved_to_id ?? null,
    cancelledBy: row.cancelled_by ?? null,
    cancelledByRole: row.cancelled_by_role ?? null,
    cancelReason: row.cancel_reason ?? null,
    cancelledAt: row.cancelled_at ?? null,
    attendanceStatus: row.attendance_status ?? 'pending',
    attendanceMarkedBy: row.attendance_marked_by ?? null,
    attendanceMarkedAt: row.attendance_marked_at ?? null,
    attendanceOverdue: row.attendance_overdue ?? false,
    attendanceNote: row.attendance_note ?? '',
    isOverride: row.is_override ?? false,
    overrideReason: row.override_reason ?? null,
    createdAt: row.created_at,
    // 조인 fetch 시 내장 슬롯
    slot: row.slot ? toBookingSlot(row.slot) : undefined,
  }
}

export function toBookingRecord(row) {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    educatorId: row.educator_id ?? null,
    studentId: row.student_id,
    programId: row.program_id,
    date: row.date,
    status: row.status ?? 'draft',
    topic: row.topic ?? '',
    diagnosis: row.diagnosis ?? '',
    advice: row.advice ?? '',
    followUp: row.follow_up ?? '',
    note: row.note ?? '',
    nextAppointment: row.next_appointment ?? '',
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
  }
}

export function toBookingNotification(row) {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    type: row.type,
    reservationId: row.reservation_id ?? null,
    slotId: row.slot_id ?? null,
    message: row.message,
    resolved: row.resolved ?? false,
    createdAt: row.created_at,
  }
}

export function toBookingAuditLog(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    reason: row.reason ?? null,
    isOverride: row.is_override ?? false,
    beforeData: row.before_data ?? null,
    afterData: row.after_data ?? null,
    createdAt: row.created_at,
  }
}

// ─── 조회 ─────────────────────────────────────────────────────

// 프로그램·교과·강사배정·오픈기간 — 전부 소량이라 한 번에 (예약 화면 공통 기초)
export async function fetchBookingConfig() {
  const [programs, subjects, educators, openPeriods] = await Promise.all([
    supabase.from('booking_programs').select('*').order('sort_order').order('created_at'),
    supabase.from('booking_subjects').select('*').order('sort_order'),
    supabase.from('booking_educators').select('*'),
    supabase.from('booking_open_periods').select('*').order('open_from', { ascending: false }),
  ])
  for (const res of [programs, subjects, educators, openPeriods]) {
    if (res.error) throw res.error
  }
  return {
    programs: (programs.data ?? []).map(toBookingProgram),
    subjects: (subjects.data ?? []).map(toBookingSubject),
    educators: (educators.data ?? []).map(toBookingEducator),
    openPeriods: (openPeriods.data ?? []).map(toBookingOpenPeriod),
  }
}

// 기간 슬롯 조회. filters: { educatorId, programId, statuses, publicOnly }
export async function fetchSlots({ from, to, educatorId, programId, statuses, publicOnly } = {}) {
  let q = supabase.from('booking_slots').select('*')
  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)
  if (educatorId) q = q.eq('educator_id', educatorId)
  if (programId) q = q.eq('program_id', programId)
  if (statuses?.length) q = q.in('status', statuses)
  if (publicOnly) q = q.eq('is_public', true)
  const { data, error } = await q.order('date').order('start_time')
  if (error) throw error
  return (data ?? []).map(toBookingSlot)
}

// 예약 조회 — 슬롯을 내장 조인으로 함께 가져온다 (기간 필터는 슬롯 date 기준)
export async function fetchReservations({ from, to, studentId, studentIds, educatorId, slotIds } = {}) {
  let q = supabase.from('booking_reservations').select('*, slot:booking_slots!inner(*)')
  if (from) q = q.gte('booking_slots.date', from)
  if (to) q = q.lte('booking_slots.date', to)
  if (studentId) q = q.eq('student_id', studentId)
  if (studentIds?.length) q = q.in('student_id', studentIds)
  if (educatorId) q = q.eq('booking_slots.educator_id', educatorId)
  if (slotIds?.length) q = q.in('slot_id', slotIds)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(toBookingReservation)
}

export async function fetchRecords({ reservationIds, educatorId, from, to } = {}) {
  let q = supabase.from('booking_records').select('*')
  if (reservationIds?.length) q = q.in('reservation_id', reservationIds)
  if (educatorId) q = q.eq('educator_id', educatorId)
  if (from) q = q.gte('date', from)
  if (to) q = q.lte('date', to)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(toBookingRecord)
}

// 슬롯별 확정 예약 수 — 학생 화면의 잔여 정원 표시용.
// 타 학생의 예약 내용을 노출하지 않도록 slot_id만 가져와 집계한다 (명세 3.1).
export async function fetchSlotCounts({ from, to } = {}) {
  let q = supabase
    .from('booking_reservations')
    .select('slot_id, slot:booking_slots!inner(date)')
    .eq('status', 'confirmed')
  if (from) q = q.gte('booking_slots.date', from)
  if (to) q = q.lte('booking_slots.date', to)
  const { data, error } = await q
  if (error) throw error
  const counts = {}
  for (const row of data ?? []) {
    counts[row.slot_id] = (counts[row.slot_id] ?? 0) + 1
  }
  return counts
}

// 이름 표시용 최소 사용자 조회 (학생 화면은 DataContext에 강사 정보가 없다)
export async function fetchUserNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return {}
  const { data, error } = await supabase.from('users').select('id, name, subject').in('id', unique)
  if (error) throw error
  const map = {}
  for (const row of data ?? []) map[row.id] = { name: row.name, subject: row.subject ?? '' }
  return map
}

// 학생 홈 '오늘의 센터 일정' 카드용 경량 이름 맵 — fetchBookingConfig(4쿼리) 대신
// 표시에 필요한 프로그램·과목 이름만 가져온다
export async function fetchBookingNameMaps() {
  const [programs, subjects] = await Promise.all([
    supabase.from('booking_programs').select('id, name'),
    supabase.from('booking_subjects').select('id, name'),
  ])
  if (programs.error) throw programs.error
  if (subjects.error) throw subjects.error
  const toMap = (rows) => Object.fromEntries((rows ?? []).map((r) => [r.id, r.name]))
  return { programNames: toMap(programs.data), subjectNames: toMap(subjects.data) }
}

export async function fetchNotifications(recipientId, { limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('booking_notifications')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(toBookingNotification)
}

export async function fetchAuditLogs({ entityType, entityId, overrideOnly, from, to, limit = 200 } = {}) {
  let q = supabase.from('booking_audit_logs').select('*')
  if (entityType) q = q.eq('entity_type', entityType)
  if (entityId) q = q.eq('entity_id', entityId)
  if (overrideOnly) q = q.eq('is_override', true)
  if (from) q = q.gte('created_at', from)
  if (to) q = q.lte('created_at', to + 'T23:59:59')
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []).map(toBookingAuditLog)
}

// ─── RPC 래퍼 — 예약·출결·슬롯 편집의 원자적 최종 검증 ─────────
// 반환: { ok, code, ... } (실패 시에도 throw하지 않는다 — code로 안내문 분기)

async function callRpc(fn, params, label) {
  const { data, error } = await withWriteRetry(() => supabase.rpc(fn, params), { label })
  if (error) throw error
  return data
}

export function rpcReserve({ slotId, studentId, actorId, actorRole, override = false, reason = null }) {
  return callRpc('booking_reserve', {
    p_slot_id: slotId, p_student_id: studentId,
    p_actor_id: actorId, p_actor_role: actorRole,
    p_override: override, p_reason: reason,
  }, 'bookingReserve')
}

export function rpcCancel({ reservationId, actorId, actorRole, reason = null, override = false }) {
  return callRpc('booking_cancel', {
    p_reservation_id: reservationId,
    p_actor_id: actorId, p_actor_role: actorRole,
    p_reason: reason, p_override: override,
  }, 'bookingCancel')
}

export function rpcChange({ reservationId, newSlotId, actorId, actorRole, override = false, reason = null }) {
  return callRpc('booking_change', {
    p_reservation_id: reservationId, p_new_slot_id: newSlotId,
    p_actor_id: actorId, p_actor_role: actorRole,
    p_override: override, p_reason: reason,
  }, 'bookingChange')
}

export function rpcAssignGroup({ slotId, studentIds, actorId, actorRole, override = false, reason = null }) {
  return callRpc('booking_assign_group', {
    p_slot_id: slotId, p_student_ids: studentIds,
    p_actor_id: actorId, p_actor_role: actorRole,
    p_override: override, p_reason: reason,
  }, 'bookingAssignGroup')
}

export function rpcSetAttendance({ reservationId, status, actorId, actorRole, note = null }) {
  return callRpc('booking_set_attendance', {
    p_reservation_id: reservationId, p_status: status,
    p_actor_id: actorId, p_actor_role: actorRole, p_note: note,
  }, 'bookingSetAttendance')
}

// patch: { date, start_time, end_time, capacity, status, is_public, note, subject_id, educator_id }
export function rpcUpdateSlot({ slotId, patch, actorId, actorRole, reason = null, del = false, override = false }) {
  return callRpc('booking_update_slot', {
    p_slot_id: slotId, p_patch: patch ?? {},
    p_actor_id: actorId, p_actor_role: actorRole,
    p_reason: reason, p_delete: del, p_override: override,
  }, 'bookingUpdateSlot')
}

export function rpcSetSlotStatus({ slotIds, status, actorId, actorRole }) {
  return callRpc('booking_set_slot_status', {
    p_slot_ids: slotIds, p_status: status,
    p_actor_id: actorId, p_actor_role: actorRole,
  }, 'bookingSetSlotStatus')
}

// ─── 클라이언트 직접 쓰기 (경합 없는 설정·기록 계열) ────────────

async function writeRow(builderFn, label) {
  const { error } = await withWriteRetry(builderFn, { label })
  if (error) throw error
}

// 감사이력 — 설정 CRUD·상담기록 저장 등 RPC를 거치지 않는 쓰기의 이력 (명세 19)
export async function logAudit({ entityType, entityId, action, actorId, actorRole, reason = null, isOverride = false, beforeData = null, afterData = null }) {
  await writeRow(() => supabase.from('booking_audit_logs').insert({
    id: makeId('bka'),
    entity_type: entityType, entity_id: entityId, action,
    actor_id: actorId, actor_role: actorRole,
    reason, is_override: isOverride,
    before_data: beforeData, after_data: afterData,
  }), 'bookingLogAudit')
}

export async function createProgram(input, actor) {
  const row = {
    id: makeId('bkp'),
    name: input.name,
    slot_minutes: input.slotMinutes,
    default_capacity: input.defaultCapacity ?? 1,
    daily_limit: input.dailyLimit ?? 1,
    daily_limit_scope: input.dailyLimitScope ?? 'program',
    allow_consecutive: input.allowConsecutive ?? true,
    allow_group: input.allowGroup ?? false,
    group_min: input.groupMin ?? 3,
    group_max: input.groupMax ?? 4,
    uses_subject: input.usesSubject ?? false,
    requires_open_period: input.requiresOpenPeriod ?? false,
    change_deadline_type: input.changeDeadlineType ?? 'minutes_before',
    change_deadline_value: input.changeDeadlineValue ?? 60,
    booking_open_lead_minutes: input.bookingOpenLeadMinutes ?? 60,
    booking_close_lead_minutes: input.bookingCloseLeadMinutes ?? 60,
    target_group_names: input.targetGroupNames ?? [],
    active: input.active ?? true,
    sort_order: input.sortOrder ?? 0,
  }
  await writeRow(() => supabase.from('booking_programs').insert(row), 'bookingCreateProgram')
  await logAudit({
    entityType: 'program', entityId: row.id, action: 'create',
    actorId: actor.id, actorRole: actor.role, afterData: row,
  })
  return toBookingProgram({ ...row, created_at: new Date().toISOString() })
}

const PROGRAM_FIELD_MAP = {
  name: 'name', slotMinutes: 'slot_minutes', defaultCapacity: 'default_capacity',
  dailyLimit: 'daily_limit', dailyLimitScope: 'daily_limit_scope',
  allowConsecutive: 'allow_consecutive', allowGroup: 'allow_group',
  groupMin: 'group_min', groupMax: 'group_max', usesSubject: 'uses_subject',
  requiresOpenPeriod: 'requires_open_period',
  changeDeadlineType: 'change_deadline_type', changeDeadlineValue: 'change_deadline_value',
  bookingOpenLeadMinutes: 'booking_open_lead_minutes',
  bookingCloseLeadMinutes: 'booking_close_lead_minutes',
  targetGroupNames: 'target_group_names', active: 'active', sortOrder: 'sort_order',
}

export async function updateProgram(id, patch, actor, before = null) {
  const row = {}
  for (const [k, v] of Object.entries(patch)) {
    if (PROGRAM_FIELD_MAP[k] && v !== undefined) row[PROGRAM_FIELD_MAP[k]] = v
  }
  await writeRow(() => supabase.from('booking_programs').update(row).eq('id', id), 'bookingUpdateProgram')
  await logAudit({
    entityType: 'program', entityId: id, action: 'update',
    actorId: actor.id, actorRole: actor.role, beforeData: before, afterData: row,
  })
}

export async function createSubject({ programId, name, sortOrder = 0 }, actor) {
  const row = { id: makeId('bksj'), program_id: programId, name, sort_order: sortOrder }
  await writeRow(() => supabase.from('booking_subjects').insert(row), 'bookingCreateSubject')
  await logAudit({
    entityType: 'subject', entityId: row.id, action: 'create',
    actorId: actor.id, actorRole: actor.role, afterData: row,
  })
  return toBookingSubject(row)
}

export async function updateSubject(id, { name, active, sortOrder }, actor) {
  const row = {}
  if (name !== undefined) row.name = name
  if (active !== undefined) row.active = active
  if (sortOrder !== undefined) row.sort_order = sortOrder
  await writeRow(() => supabase.from('booking_subjects').update(row).eq('id', id), 'bookingUpdateSubject')
  await logAudit({
    entityType: 'subject', entityId: id, action: 'update',
    actorId: actor.id, actorRole: actor.role, afterData: row,
  })
}

export async function assignEducator({ programId, educatorId, subjectId = null }, actor) {
  const row = { id: makeId('bke'), program_id: programId, educator_id: educatorId, subject_id: subjectId }
  await writeRow(() => supabase.from('booking_educators').insert(row), 'bookingAssignEducator')
  await logAudit({
    entityType: 'educator', entityId: row.id, action: 'create',
    actorId: actor.id, actorRole: actor.role, afterData: row,
  })
  return toBookingEducator(row)
}

export async function removeEducator(id, actor, before = null) {
  await writeRow(() => supabase.from('booking_educators').delete().eq('id', id), 'bookingRemoveEducator')
  await logAudit({
    entityType: 'educator', entityId: id, action: 'delete',
    actorId: actor.id, actorRole: actor.role, beforeData: before,
  })
}

export async function createOpenPeriod(input, actor) {
  const row = {
    id: makeId('bkop'),
    program_id: input.programId,
    target_start: input.targetStart,
    target_end: input.targetEnd,
    open_from: input.openFrom,
    open_until: input.openUntil,
    note: input.note ?? '',
    created_by: actor.id,
  }
  await writeRow(() => supabase.from('booking_open_periods').insert(row), 'bookingCreateOpenPeriod')
  await logAudit({
    entityType: 'open_period', entityId: row.id, action: 'create',
    actorId: actor.id, actorRole: actor.role, afterData: row,
  })
  return toBookingOpenPeriod({ ...row, created_at: new Date().toISOString() })
}

export async function updateOpenPeriod(id, patch, actor) {
  const row = {}
  if (patch.targetStart !== undefined) row.target_start = patch.targetStart
  if (patch.targetEnd !== undefined) row.target_end = patch.targetEnd
  if (patch.openFrom !== undefined) row.open_from = patch.openFrom
  if (patch.openUntil !== undefined) row.open_until = patch.openUntil
  if (patch.note !== undefined) row.note = patch.note
  await writeRow(() => supabase.from('booking_open_periods').update(row).eq('id', id), 'bookingUpdateOpenPeriod')
  await logAudit({
    entityType: 'open_period', entityId: id, action: 'update',
    actorId: actor.id, actorRole: actor.role, afterData: row,
  })
}

export async function deleteOpenPeriod(id, actor) {
  await writeRow(() => supabase.from('booking_open_periods').delete().eq('id', id), 'bookingDeleteOpenPeriod')
  await logAudit({
    entityType: 'open_period', entityId: id, action: 'delete',
    actorId: actor.id, actorRole: actor.role,
  })
}

// 타임테이블 일괄 생성 — slotGeneration.js가 만든 슬롯 배열을 배치와 함께 저장
export async function createSlotBatch({ programId, params, slots }, actor) {
  const batchId = makeId('bkb')
  await writeRow(() => supabase.from('booking_timetable_batches').insert({
    id: batchId, program_id: programId, params, created_by: actor.id,
  }), 'bookingCreateBatch')

  const rows = slots.map((s) => ({
    id: makeId('bks'),
    program_id: programId,
    educator_id: s.educatorId ?? null,
    subject_id: s.subjectId ?? null,
    batch_id: batchId,
    date: s.date,
    start_time: s.startTime,
    end_time: s.endTime,
    capacity: s.capacity,
    status: 'draft',
    is_public: s.isPublic ?? true,
    note: s.note ?? '',
    created_by: actor.id,
  }))
  await writeRow(() => supabase.from('booking_slots').insert(rows), 'bookingInsertSlots')
  await logAudit({
    entityType: 'slot', entityId: batchId, action: 'create',
    actorId: actor.id, actorRole: actor.role,
    afterData: { batch_id: batchId, count: rows.length, params },
  })
  return { batchId, slots: rows.map(toBookingSlot) }
}

// 강사의 단일 슬롯 생성 (그룹상담 편성 등 — 비공개 기본은 호출측에서 지정)
export async function createSlot(input, actor) {
  const row = {
    id: makeId('bks'),
    program_id: input.programId,
    educator_id: input.educatorId ?? null,
    subject_id: input.subjectId ?? null,
    batch_id: null,
    date: input.date,
    start_time: input.startTime,
    end_time: input.endTime,
    capacity: input.capacity ?? 1,
    status: input.status ?? 'open',
    is_public: input.isPublic ?? true,
    note: input.note ?? '',
    created_by: actor.id,
  }
  await writeRow(() => supabase.from('booking_slots').insert(row), 'bookingCreateSlot')
  await logAudit({
    entityType: 'slot', entityId: row.id, action: 'create',
    actorId: actor.id, actorRole: actor.role, afterData: row,
  })
  return toBookingSlot(row)
}

// 상담기록 저장 — 경합이 없어 RPC 불필요. reservation_id UNIQUE라 upsert.
export async function saveRecord(input, actor) {
  const done = input.status === 'done'
  const row = {
    id: input.id ?? makeId('bkc'),
    reservation_id: input.reservationId,
    educator_id: input.educatorId ?? actor.id,
    student_id: input.studentId,
    program_id: input.programId,
    date: input.date,
    status: input.status ?? 'draft',
    topic: input.topic ?? '',
    diagnosis: input.diagnosis ?? '',
    advice: input.advice ?? '',
    follow_up: input.followUp ?? '',
    note: input.note ?? '',
    next_appointment: input.nextAppointment ?? '',
    // 작성 완료 시각 — 기한 초과 작성 판정용 (7일 지평의 저위험 판정이라 클라 시각 허용)
    completed_at: done ? new Date().toISOString() : null,
  }
  await writeRow(() => supabase.from('booking_records').upsert(row, { onConflict: 'reservation_id' }), 'bookingSaveRecord')
  await logAudit({
    entityType: 'record', entityId: row.id, action: input.id ? 'update' : 'create',
    actorId: actor.id, actorRole: actor.role, afterData: row,
  })
  return toBookingRecord({ ...row, created_at: input.createdAt ?? new Date().toISOString() })
}

export async function resolveNotification(id) {
  await writeRow(() => supabase.from('booking_notifications').update({ resolved: true }).eq('id', id), 'bookingResolveNotification')
}

export async function resolveAllNotifications(recipientId) {
  await writeRow(() => supabase.from('booking_notifications').update({ resolved: true })
    .eq('recipient_id', recipientId).eq('resolved', false), 'bookingResolveAllNotifications')
}
