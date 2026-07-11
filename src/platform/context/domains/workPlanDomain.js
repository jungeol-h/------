// [Write] 업무계획 도메인 — 관리자 일정 CRUD (일시/업무유형/대상학생/메모).
// types·studentIds는 jsonb 배열 (유형 중복 체크, 대상 학생 복수 허용).

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toWorkPlan } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

export function useWorkPlanDomain(setData) {
  const addWorkPlan = useCallback(
    async ({ authorId, planDate, planTime = '', types = [], studentIds = [], memo = '' }) => {
      const row = {
        id: makeId('wp'),
        author_id: authorId,
        plan_date: planDate,
        plan_time: planTime,
        types,
        student_ids: studentIds,
        memo,
        status: 'planned',
      }
      const { error } = await withWriteRetry(
        () => supabase.from('work_plans').insert(row),
        { label: 'addWorkPlan' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        workPlans: [toWorkPlan({ ...row, created_at: new Date().toISOString() }), ...prev.workPlans],
      }))
    },
    [setData]
  )

  const updateWorkPlan = useCallback(
    async (id, patch) => {
      const snake = {}
      if (patch.planDate !== undefined) snake.plan_date = patch.planDate
      if (patch.planTime !== undefined) snake.plan_time = patch.planTime
      if (patch.types !== undefined) snake.types = patch.types
      if (patch.studentIds !== undefined) snake.student_ids = patch.studentIds
      if (patch.memo !== undefined) snake.memo = patch.memo
      if (patch.status !== undefined) snake.status = patch.status
      if (Object.keys(snake).length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('work_plans').update(snake).eq('id', id),
        { label: 'updateWorkPlan' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        workPlans: prev.workPlans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }))
    },
    [setData]
  )

  const deleteWorkPlan = useCallback(
    async (id) => {
      const { error } = await withWriteRetry(
        () => supabase.from('work_plans').delete().eq('id', id),
        { label: 'deleteWorkPlan' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        workPlans: prev.workPlans.filter((p) => p.id !== id),
      }))
    },
    [setData]
  )

  return { addWorkPlan, updateWorkPlan, deleteWorkPlan }
}
