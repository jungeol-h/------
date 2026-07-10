// [Write] 학부모 계정 도메인 CRUD (관리자 사용자 관리).
// 학부모 계정(users.role='parent') + 자녀 매핑(parent_children)을 함께 처리한다.
// 한 동작이 users+parent_children 두 테이블에 걸치므로 한 도메인에 둔다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toUser, toParentChild } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

export function useParentDomain(setData) {
  // 학부모 신규 추가 (계정 + 자녀 매핑)
  const addParent = useCallback(
    async ({ name, loginId, password, childIds = [] }) => {
      const id = makeId('p')
      const row = {
        id,
        login_id: loginId,
        password,
        name,
        role: 'parent',
        status: 'active',
      }
      const { error } = await withWriteRetry(
        () => supabase.from('users').insert(row),
        { label: 'addParent' }
      )
      if (error) {
        if (error.code === '23505') throw new Error('이미 사용 중인 login_id입니다.')
        throw error
      }

      const linkRows = childIds.map((studentId) => ({
        id: makeId('pc'),
        parent_id: id,
        student_id: studentId,
      }))
      let newLinks = []
      if (linkRows.length > 0) {
        const { error: linkErr } = await withWriteRetry(
          () => supabase.from('parent_children').insert(linkRows),
          { label: 'addParent' }
        )
        if (!linkErr) newLinks = linkRows.map(toParentChild)
      }

      const local = toUser(row)
      setData((prev) => ({
        ...prev,
        parents: [...(prev.parents ?? []), local],
        parentChildren: [...(prev.parentChildren ?? []), ...newLinks],
      }))
      return local
    },
    [setData]
  )

  // 학부모 계정 정보 수정 (자녀 매핑은 setParentChildren에서 별도 처리)
  const updateParent = useCallback(
    async (id, { name, loginId, password }) => {
      const snake = {}
      if (name !== undefined) snake.name = name
      if (loginId !== undefined) snake.login_id = loginId
      if (password !== undefined) snake.password = password
      if (Object.keys(snake).length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('users').update(snake).eq('id', id),
        { label: 'updateParent' }
      )
      if (error) {
        if (error.code === '23505') throw new Error('이미 사용 중인 login_id입니다.')
        throw error
      }
      const localPatch = {}
      if (name !== undefined) localPatch.name = name
      if (loginId !== undefined) localPatch.loginId = loginId
      if (password !== undefined) localPatch.password = password
      setData((prev) => ({
        ...prev,
        parents: (prev.parents ?? []).map((p) =>
          p.id === id ? { ...p, ...localPatch } : p
        ),
      }))
    },
    [setData]
  )

  // 학부모 계정 삭제 (parent_children는 FK CASCADE로 함께 삭제됨)
  const deleteParent = useCallback(
    async (id) => {
      const { error } = await withWriteRetry(
        () => supabase.from('users').delete().eq('id', id),
        { label: 'deleteParent' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        parents: (prev.parents ?? []).filter((p) => p.id !== id),
        parentChildren: (prev.parentChildren ?? []).filter((l) => l.parentId !== id),
      }))
    },
    [setData]
  )

  // 자녀 매핑 갈아치우기 — 기존 매핑 전부 삭제 후 신규 insert
  const setParentChildren = useCallback(
    async (parentId, childIds = []) => {
      await withWriteRetry(
        () => supabase.from('parent_children').delete().eq('parent_id', parentId),
        { label: 'setParentChildren' }
      )
      const linkRows = childIds.map((studentId) => ({
        id: makeId('pc'),
        parent_id: parentId,
        student_id: studentId,
      }))
      let newLinks = []
      if (linkRows.length > 0) {
        const { error: insErr } = await withWriteRetry(
          () => supabase.from('parent_children').insert(linkRows),
          { label: 'setParentChildren' }
        )
        if (insErr) throw insErr
        newLinks = linkRows.map(toParentChild)
      }
      setData((prev) => ({
        ...prev,
        parentChildren: [
          ...(prev.parentChildren ?? []).filter((l) => l.parentId !== parentId),
          ...newLinks,
        ],
      }))
    },
    [setData]
  )

  return { addParent, updateParent, deleteParent, setParentChildren }
}
