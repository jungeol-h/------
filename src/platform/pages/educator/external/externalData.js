// 외생(외부) 상담 프로그램 전용 데이터 접근 계층.
//
// 설계 원칙: 이 데이터는 DataContext에 넣지 않는다. 외부상담 모듈 진입 시점에
// supabase에서 직접 lazy fetch하고 로컬 state로만 관리한다. 재원생 상담탭/통계/
// DataContext와 완전히 격리되어 기존 동작 회귀 위험이 0이다.
//
// snake_case DB ↔ camelCase 변환은 이 모듈 전용 로컬 함수로 처리한다
// (공용 supabaseHelpers.js는 건드리지 않는다).

import { supabase } from '../../../lib/supabase.js'
import { withWriteRetry } from '../../../lib/supabaseRetry.js'
import { makeId } from '../../../context/dataModel.js'

// ─── 로컬 변환 ─────────────────────────────────────────────────

export function toProgram(row) {
  return {
    id: row.id,
    name: row.name,
    year: row.year,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function toProgramStudent(row) {
  return {
    id: row.id,
    programId: row.program_id,
    name: row.name,
    school: row.school,
    grade: row.grade,
    memo: row.memo,
    createdAt: row.created_at,
  }
}

export function toProgramRecord(row) {
  return {
    id: row.id,
    programStudentId: row.program_student_id,
    counselorId: row.counselor_id,
    date: row.date,
    content: row.content,
    type: row.type,
    targetType: row.target_type ?? 'student',
    // 보고서 양식 6단계 — 구 기록은 단일 content만 존재
    topic: row.topic ?? '',
    diagnosis: row.diagnosis ?? '',
    advice: row.advice ?? '',
    followUp: row.follow_up ?? '',
    note: row.note ?? '',
    nextAppointment: row.next_appointment ?? '',
    createdAt: row.created_at,
  }
}

// ─── 파싱 ─────────────────────────────────────────────────────

// 한 줄당 `이름[탭 또는 쉼표]학교[탭 또는 쉼표]학년` → [{ name, school, grade }]
export function parseStudentLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[\t,]/).map((p) => p.trim())
      return {
        name: parts[0] || '',
        school: parts[1] || '',
        grade: parts[2] || '',
      }
    })
    .filter((e) => e.name)
}

// ─── 조회 ─────────────────────────────────────────────────────

// 프로그램 목록. active 우선 정렬, 전체 반환.
export async function fetchPrograms() {
  const { data, error } = await supabase
    .from('counseling_programs')
    .select('*')
    .order('year', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  const programs = (data ?? []).map(toProgram)
  // active를 앞으로
  programs.sort((a, b) => {
    const av = a.status === 'active' ? 0 : 1
    const bv = b.status === 'active' ? 0 : 1
    return av - bv
  })
  return programs
}

// 특정 프로그램의 학생 + 상담기록을 한 번에.
export async function fetchProgramDetail(programId) {
  const { data: studentRows, error: sErr } = await supabase
    .from('program_students')
    .select('*')
    .eq('program_id', programId)
    .order('created_at', { ascending: true })
  if (sErr) throw sErr
  const students = (studentRows ?? []).map(toProgramStudent)

  const ids = students.map((s) => s.id)
  let records = []
  if (ids.length > 0) {
    const { data: recRows, error: rErr } = await supabase
      .from('program_counseling_records')
      .select('*')
      .in('program_student_id', ids)
      .order('date', { ascending: false })
    if (rErr) throw rErr
    records = (recRows ?? []).map(toProgramRecord)
  }
  return { students, records }
}

// ─── 쓰기 ─────────────────────────────────────────────────────

export async function createProgram({ name, year }) {
  const row = {
    id: makeId('cp'),
    name,
    year: year ?? null,
    status: 'active',
  }
  const { error } = await withWriteRetry(
    () => supabase.from('counseling_programs').insert(row),
    { label: 'createProgram' },
  )
  if (error) throw error
  return toProgram({ ...row, created_at: new Date().toISOString() })
}

// 학생 일괄 등록. entries: [{ name, school, grade }]
export async function bulkInsertStudents(programId, entries) {
  const rows = entries.map((e) => ({
    id: makeId('ps'),
    program_id: programId,
    name: e.name,
    school: e.school || null,
    grade: e.grade || null,
    memo: e.memo || null,
  }))
  const { error } = await withWriteRetry(
    () => supabase.from('program_students').insert(rows),
    { label: 'bulkInsertStudents' },
  )
  if (error) throw error
  const now = new Date().toISOString()
  return rows.map((r) => toProgramStudent({ ...r, created_at: now }))
}

export async function createRecord({ programStudentId, counselorId, content, type, targetType, date, fields }) {
  const row = {
    id: makeId('pc'),
    program_student_id: programStudentId,
    counselor_id: counselorId,
    date: date ?? new Date().toISOString().slice(0, 10),
    content,
    type: type ?? 'etc',
    target_type: targetType ?? 'student',
    topic: fields?.topic ?? null,
    diagnosis: fields?.diagnosis ?? null,
    advice: fields?.advice ?? null,
    follow_up: fields?.followUp ?? null,
    note: fields?.note ?? null,
    next_appointment: fields?.nextAppointment ?? null,
  }
  const { error } = await withWriteRetry(
    () => supabase.from('program_counseling_records').insert(row),
    { label: 'createProgramRecord' },
  )
  if (error) throw error
  return toProgramRecord({ ...row, created_at: new Date().toISOString() })
}

export async function updateRecord(id, { content, type, targetType, fields }) {
  const patch = {}
  if (content !== undefined) patch.content = content
  if (type !== undefined) patch.type = type
  if (targetType !== undefined) patch.target_type = targetType
  if (fields !== undefined) {
    patch.topic = fields.topic ?? null
    patch.diagnosis = fields.diagnosis ?? null
    patch.advice = fields.advice ?? null
    patch.follow_up = fields.followUp ?? null
    patch.note = fields.note ?? null
    patch.next_appointment = fields.nextAppointment ?? null
  }
  const { error } = await withWriteRetry(
    () => supabase.from('program_counseling_records').update(patch).eq('id', id),
    { label: 'updateProgramRecord' },
  )
  if (error) throw error
}

export async function deleteRecord(id) {
  const { error } = await withWriteRetry(
    () => supabase.from('program_counseling_records').delete().eq('id', id),
    { label: 'deleteProgramRecord' },
  )
  if (error) throw error
}
