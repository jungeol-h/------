// [Write] 학생 도메인 CRUD (관리자 사용자 관리). 학생 생성/수정 시 배정
// (assignments)도 함께 처리한다 — 한 동작이 본래 users+assignments 두 테이블에
// 걸치므로 한 도메인에 둔다.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toUser, toAssignment } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'

export function useStudentDomain(setData) {
  // 학생 신규 추가
  const createStudent = useCallback(
    async ({
      name, gender, grade, className, school,
      loginId, password, parentPassword, managerId,
    }) => {
      const id = makeId('s')
      const row = {
        id,
        login_id: loginId,
        password,
        name,
        role: 'student',
        school: school ?? '',
        grade: grade ?? '',
        class_name: className ?? '',
        parent_password: parentPassword ?? '',
        gender: gender ?? null,
        self_index: 70,
        risk_level: 'normal',
        status: 'active',
      }
      const { error } = await supabase.from('users').insert(row)
      if (error) {
        console.error('createStudent insert error:', error)
        if (error.code === '23505') {
          throw new Error('이미 사용 중인 login_id입니다.')
        }
        throw error
      }

      let newAssignment = null
      if (managerId) {
        const assn = { student_id: id, educator_id: managerId }
        const { error: aErr } = await supabase.from('assignments').insert(assn)
        if (aErr) console.error('createStudent assignment insert error:', aErr)
        else newAssignment = toAssignment(assn)
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

  // 학생 정보 수정. patch에 managerId 키가 있으면 assignments를 갈아치운다.
  const updateStudent = useCallback(
    async (studentId, patch) => {
      const snake = {}
      if (patch.name !== undefined) snake.name = patch.name
      if (patch.loginId !== undefined) snake.login_id = patch.loginId
      if (patch.password !== undefined) snake.password = patch.password
      if (patch.gender !== undefined) snake.gender = patch.gender
      if (patch.grade !== undefined) snake.grade = patch.grade
      if (patch.className !== undefined) snake.class_name = patch.className
      if (patch.school !== undefined) snake.school = patch.school
      if (patch.parentPassword !== undefined) snake.parent_password = patch.parentPassword

      if (Object.keys(snake).length > 0) {
        const { error } = await supabase.from('users').update(snake).eq('id', studentId)
        if (error) {
          console.error('updateStudent update error:', error)
          if (error.code === '23505') {
            throw new Error('이미 사용 중인 login_id입니다.')
          }
          throw error
        }
      }

      // managerId 변경: 기존 assignments 모두 삭제 후 신규 1개 insert
      let assignmentsPatch = null
      if (patch.managerId !== undefined) {
        const { error: delErr } = await supabase
          .from('assignments')
          .delete()
          .eq('student_id', studentId)
        if (delErr) console.error('updateStudent assignment delete error:', delErr)

        if (patch.managerId) {
          const assn = { student_id: studentId, educator_id: patch.managerId }
          const { error: insErr } = await supabase.from('assignments').insert(assn)
          if (insErr) console.error('updateStudent assignment insert error:', insErr)
          else assignmentsPatch = toAssignment(assn)
        } else {
          assignmentsPatch = 'cleared'
        }
      }

      const localPatch = { ...patch }
      delete localPatch.managerId

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

  // 학생 활성/비활성 토글 (soft delete)
  const setStudentStatus = useCallback(
    async (studentId, status) => {
      const { error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', studentId)
      if (error) {
        console.error('setStudentStatus update error:', error)
        throw error
      }
      setData((prev) => ({
        ...prev,
        students: prev.students.map((s) =>
          s.id === studentId ? { ...s, status } : s
        ),
      }))
    },
    [setData]
  )

  return { createStudent, updateStudent, setStudentStatus }
}
