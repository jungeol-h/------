// [Write] 학생 도메인 CRUD (관리자 사용자 관리). 학생 생성/수정 시 배정
// (assignments)도 함께 처리한다 — 한 동작이 본래 users+assignments 두 테이블에
// 걸치므로 한 도메인에 둔다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toUser, toAssignment } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'
import { hashPassword, INITIAL_COST } from '../../lib/passwords.js'
import { PLACEHOLDER_PHONE } from '../../utils/studentDedup.js'
import { todayStr } from '../../utils/dateUtils.js'
import { reportError } from '../../lib/sentry.js'

// 초기 비밀번호 = 학생 전화번호(없으면 자리표시 값) 해시.
// password_changed_at은 null로 두어 첫 로그인 시 강제 재설정을 유도한다.
const initialPasswordOf = (phone) => hashPassword(phone || PLACEHOLDER_PHONE, INITIAL_COST)

export function useStudentDomain(setData) {
  // 학생 신규 추가
  const createStudent = useCallback(
    async ({
      name, gender, grade, className, school,
      loginId, phone, parentPhone, managerId, enrolledAt, groups,
    }) => {
      const id = makeId('s')
      const row = {
        id,
        login_id: loginId,
        password: await initialPasswordOf(phone),
        password_changed_at: null,
        phone: phone || null,
        parent_phone: parentPhone || null,
        name,
        role: 'student',
        school: school ?? '',
        grade: grade ?? '',
        class_name: className ?? '',
        group_names: groups ?? [],
        gender: gender ?? null,
        self_index: 70,
        risk_level: 'normal',
        status: 'active',
        enrolled_at: enrolledAt || null,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('users').insert(row),
        { label: 'createStudent' }
      )
      if (error) {
        if (error.code === '23505') {
          throw new Error(/name_phone/.test(error.message ?? '')
            ? '같은 이름·전화번호의 학생이 이미 등록돼 있습니다.'
            : '이미 사용 중인 login_id입니다.')
        }
        throw error
      }

      let newAssignment = null
      if (managerId) {
        const assn = { student_id: id, educator_id: managerId }
        const { error: aErr } = await withWriteRetry(
          () => supabase.from('assignments').insert(assn),
          { label: 'createStudent' }
        )
        if (!aErr) newAssignment = toAssignment(assn)
      }

      const local = toUser(row)
      setData((prev) => ({
        ...prev,
        students: [...prev.students, local],
        assignments: newAssignment
          ? [...prev.assignments, newAssignment]
          : prev.assignments,
      }))
      return local
    },
    [setData]
  )

  // 학생 일괄 등록 (엑셀 업로드) — login_id가 이미 있는 행은 건너뛰고(ignoreDuplicates)
  // 실제 삽입된 행만 로컬 반영. 반환: { inserted, skipped }
  // 초기 비밀번호 해시는 행마다 수행 — INITIAL_COST라 수십 명 기준 수 초 내.
  const bulkCreateStudents = useCallback(
    async (list) => {
      const rows = await Promise.all(list.map(async (s) => ({
        id: makeId('s'),
        login_id: s.loginId,
        password: await initialPasswordOf(s.phone),
        password_changed_at: null,
        phone: s.phone || null,
        parent_phone: s.parentPhone || null,
        name: s.name,
        role: 'student',
        school: s.school ?? '',
        grade: s.grade ?? '',
        class_name: s.className ?? '',
        group_names: s.groups ?? [],
        gender: s.gender ?? null,
        self_index: 70,
        risk_level: 'normal',
        status: s.status ?? 'active',
        enrolled_at: s.enrolledAt || null,
      })))
      const { data: inserted, error } = await withWriteRetry(
        () => supabase
          .from('users')
          .upsert(rows, { onConflict: 'login_id', ignoreDuplicates: true })
          .select(),
        { label: 'bulkCreateStudents' }
      )
      if (error) throw error
      const locals = (inserted ?? []).map(toUser)
      setData((prev) => ({ ...prev, students: [...prev.students, ...locals] }))
      return { inserted: locals.length, skipped: rows.length - locals.length }
    },
    [setData]
  )

  // 학생 정보 수정. patch에 managerId 키가 있으면 assignments를 갈아치운다.
  // patch.resetPassword가 참이면 비밀번호를 초기값(=연락처)으로 되돌리고
  // 강제 재설정 플래그(password_changed_at=null)를 세운다.
  const updateStudent = useCallback(
    async (studentId, patch) => {
      const snake = {}
      if (patch.name !== undefined) snake.name = patch.name
      if (patch.loginId !== undefined) snake.login_id = patch.loginId
      if (patch.gender !== undefined) snake.gender = patch.gender
      if (patch.grade !== undefined) snake.grade = patch.grade
      if (patch.className !== undefined) snake.class_name = patch.className
      if (patch.school !== undefined) snake.school = patch.school
      if (patch.groups !== undefined) snake.group_names = patch.groups
      if (patch.phone !== undefined) snake.phone = patch.phone || null
      if (patch.parentPhone !== undefined) snake.parent_phone = patch.parentPhone || null
      if (patch.enrolledAt !== undefined) snake.enrolled_at = patch.enrolledAt || null
      if (patch.resetPassword) {
        snake.password = await initialPasswordOf(patch.phone)
        snake.password_changed_at = null
      }

      if (Object.keys(snake).length > 0) {
        const { error } = await withWriteRetry(
          () => supabase.from('users').update(snake).eq('id', studentId),
          { label: 'updateStudent' }
        )
        if (error) {
          if (error.code === '23505') {
            throw new Error(/name_phone/.test(error.message ?? '')
              ? '같은 이름·전화번호의 학생이 이미 등록돼 있습니다.'
              : '이미 사용 중인 login_id입니다.')
          }
          throw error
        }
      }

      // managerId 변경: 기존 assignments 모두 삭제 후 신규 1개 insert
      let assignmentsPatch = null
      if (patch.managerId !== undefined) {
        await withWriteRetry(
          () => supabase.from('assignments').delete().eq('student_id', studentId),
          { label: 'updateStudent' }
        )

        if (patch.managerId) {
          const assn = { student_id: studentId, educator_id: patch.managerId }
          const { error: insErr } = await withWriteRetry(
            () => supabase.from('assignments').insert(assn),
            { label: 'updateStudent' }
          )
          if (!insErr) assignmentsPatch = toAssignment(assn)
        } else {
          assignmentsPatch = 'cleared'
        }
      }

      const localPatch = { ...patch }
      delete localPatch.managerId
      delete localPatch.resetPassword
      if (patch.resetPassword) localPatch.passwordChangedAt = null

      setData((prev) => {
        let nextAssignments = prev.assignments
        if (patch.managerId !== undefined) {
          nextAssignments = prev.assignments.filter((a) => a.studentId !== studentId)
          if (assignmentsPatch && assignmentsPatch !== 'cleared') {
            nextAssignments = [...nextAssignments, assignmentsPatch]
          }
        }
        return {
          ...prev,
          students: prev.students.map((s) =>
            s.id === studentId ? { ...s, ...localPatch } : s
          ),
          assignments: nextAssignments,
        }
      })
    },
    [setData]
  )

  // 교직원 소속 그룹 수정 (admin 전용 UI — 사용자 관리 탭 교육자 목록)
  const updateEducatorGroups = useCallback(
    async (educatorId, groups) => {
      const { error } = await withWriteRetry(
        () => supabase.from('users').update({ group_names: groups }).eq('id', educatorId),
        { label: 'updateEducatorGroups' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        educators: prev.educators.map((e) =>
          e.id === educatorId ? { ...e, groups } : e
        ),
      }))
    },
    [setData]
  )

  // 학생 등록 상태 변경 (soft delete) — status: data/studentStatus.js 값.
  // 퇴원·신청취소 전환 시 연관 일정을 정리한다 (2026-08 클라이언트: 퇴소 학생이
  // 출결 미처리·예약 목록에 계속 잡히는 문제):
  //  ① 센터 이용시간 등록 삭제 ② 등·하원 시간표 삭제 ③ 오늘 이후 확정 예약을
  //  센터 사유로 일괄 취소(booking_cancel RPC — 알림·감사이력 포함).
  // 정리는 best-effort — 실패해도 상태 변경 자체는 유지하고 Sentry에만 보고.
  // 반환: { cancelledBookings } (재원 복귀 시 이용시간은 다시 등록해야 한다).
  const setStudentStatus = useCallback(
    async (studentId, status, { actorId = null } = {}) => {
      const { error } = await withWriteRetry(
        () => supabase.from('users').update({ status }).eq('id', studentId),
        { label: 'setStudentStatus' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        students: prev.students.map((s) =>
          s.id === studentId ? { ...s, status } : s
        ),
      }))

      let cancelledBookings = 0
      if (status !== 'active') {
        try {
          await supabase.from('center_hour_registrations').delete().eq('student_id', studentId)
          await supabase.from('attendance_schedules').delete().eq('student_id', studentId)
          setData((prev) => ({
            ...prev,
            attendanceSchedules: prev.attendanceSchedules.filter((s) => s.studentId !== studentId),
          }))

          const { data: future } = await supabase
            .from('booking_reservations')
            .select('id, booking_slots!inner(date)')
            .eq('student_id', studentId)
            .eq('status', 'confirmed')
            .gte('booking_slots.date', todayStr())
          for (const r of future ?? []) {
            const { data: res } = await supabase.rpc('booking_cancel', {
              p_reservation_id: r.id,
              p_actor_id: actorId,
              p_actor_role: 'admin',
              p_reason: '학생 퇴원·신청취소 처리에 따른 일괄 취소',
            })
            if (res?.ok) cancelledBookings += 1
          }
        } catch (err) {
          reportError(err, { where: 'setStudentStatus.cleanup', studentId, status })
        }
      }
      return { cancelledBookings }
    },
    [setData]
  )

  // 학습일지 첨부 메타 저장 (users.study_journals jsonb) — 실파일은 lib/studyJournalFiles.js
  const setStudentJournals = useCallback(
    async (studentId, journals) => {
      const { error } = await withWriteRetry(
        () => supabase.from('users').update({ study_journals: journals }).eq('id', studentId),
        { label: 'setStudentJournals' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        students: prev.students.map((s) =>
          s.id === studentId ? { ...s, studyJournals: journals } : s
        ),
      }))
    },
    [setData]
  )

  return { createStudent, bulkCreateStudents, updateStudent, updateEducatorGroups, setStudentStatus, setStudentJournals }
}
