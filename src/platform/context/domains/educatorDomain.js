// [Write] 교직원 계정 도메인 CRUD (관리자 사용자 관리).
// users.role in (manager/instructor/consultant/viewer) 계정의 생성·수정·상태전환·삭제.
// admin 계정은 UI에서 만들거나 지울 수 없다 — 여기서도 방어한다.
// 완전 삭제는 FK CASCADE로 그 계정이 작성한 상담·수업 기록까지 지우므로
// 호출부(UserManagementTab)에서 이름 입력 이중확인을 거친 뒤에만 부른다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toUser } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'
import { hashPassword, INITIAL_COST } from '../../lib/passwords.js'

// UI에서 생성/수정 가능한 역할 화이트리스트 (admin 제외)
export const EDUCATOR_MANAGED_ROLES = ['manager', 'instructor', 'consultant', 'viewer']

export function useEducatorDomain(setData) {
  // 교직원 신규 추가 — 초기 비밀번호 = 본인 연락처(해시), 첫 로그인 시 강제 재설정
  const createEducator = useCallback(
    async ({ name, role, loginId, phone, subject, workSchedule, groups }) => {
      if (!EDUCATOR_MANAGED_ROLES.includes(role)) {
        throw new Error('허용되지 않은 역할입니다.')
      }
      const id = makeId('e')
      const row = {
        id,
        login_id: loginId,
        password: await hashPassword(phone, INITIAL_COST),
        password_changed_at: null,
        phone: phone || null,
        name,
        role,
        subject: subject ?? '',
        work_schedule: workSchedule || null,
        group_names: groups ?? [],
        status: 'active',
      }
      const { error } = await withWriteRetry(
        () => supabase.from('users').insert(row),
        { label: 'createEducator' }
      )
      if (error) {
        if (error.code === '23505') throw new Error('이미 사용 중인 login_id입니다.')
        throw error
      }
      const local = toUser(row)
      setData((prev) => ({
        ...prev,
        educators: [...prev.educators, local],
      }))
      return local
    },
    [setData]
  )

  // 교직원 정보 수정 — patch에 있는 키만 부분 업데이트.
  // patch.resetPassword가 참이면 비밀번호를 초기값(=연락처)으로 되돌린다.
  const updateEducator = useCallback(
    async (id, patch) => {
      if (patch.role !== undefined && !EDUCATOR_MANAGED_ROLES.includes(patch.role)) {
        throw new Error('허용되지 않은 역할입니다.')
      }
      const snake = {}
      if (patch.name !== undefined) snake.name = patch.name
      if (patch.loginId !== undefined) snake.login_id = patch.loginId
      if (patch.phone !== undefined) snake.phone = patch.phone || null
      if (patch.role !== undefined) snake.role = patch.role
      if (patch.subject !== undefined) snake.subject = patch.subject
      if (patch.workSchedule !== undefined) snake.work_schedule = patch.workSchedule || null
      if (patch.groups !== undefined) snake.group_names = patch.groups
      if (patch.resetPassword) {
        snake.password = await hashPassword(patch.phone, INITIAL_COST)
        snake.password_changed_at = null
      }
      if (Object.keys(snake).length === 0) return

      // admin 계정 방어 — role 조건으로 수정 대상을 관리 역할로 한정
      const { data: updated, error } = await withWriteRetry(
        () => supabase.from('users').update(snake)
          .eq('id', id).in('role', EDUCATOR_MANAGED_ROLES).select(),
        { label: 'updateEducator' }
      )
      if (error) {
        if (error.code === '23505') throw new Error('이미 사용 중인 login_id입니다.')
        throw error
      }
      if (!updated || updated.length === 0) {
        throw new Error('관리자 계정은 여기서 수정할 수 없습니다.')
      }
      const localPatch = { ...patch }
      delete localPatch.resetPassword
      if (patch.resetPassword) localPatch.passwordChangedAt = null
      setData((prev) => ({
        ...prev,
        educators: prev.educators.map((e) =>
          e.id === id ? { ...e, ...localPatch } : e
        ),
      }))
    },
    [setData]
  )

  // 교직원 상태 전환 (soft delete) — 'inactive'면 로그인 차단·목록 숨김, 기록 보존
  const setEducatorStatus = useCallback(
    async (id, status) => {
      const { error } = await withWriteRetry(
        () => supabase.from('users').update({ status })
          .eq('id', id).in('role', EDUCATOR_MANAGED_ROLES),
        { label: 'setEducatorStatus' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        educators: prev.educators.map((e) =>
          e.id === id ? { ...e, status } : e
        ),
      }))
    },
    [setData]
  )

  // 교직원 완전 삭제 — FK CASCADE로 작성 기록까지 소실됨. 호출부 이중확인 필수.
  const deleteEducator = useCallback(
    async (id) => {
      const { data: deleted, error } = await withWriteRetry(
        () => supabase.from('users').delete()
          .eq('id', id).in('role', EDUCATOR_MANAGED_ROLES).select(),
        { label: 'deleteEducator' }
      )
      if (error) throw error
      if (!deleted || deleted.length === 0) {
        throw new Error('관리자 계정은 삭제할 수 없습니다.')
      }
      setData((prev) => ({
        ...prev,
        educators: prev.educators.filter((e) => e.id !== id),
      }))
    },
    [setData]
  )

  return { createEducator, updateEducator, setEducatorStatus, deleteEducator }
}
