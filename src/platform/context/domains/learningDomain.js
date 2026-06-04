// [Write] 학습 기록 도메인 CRUD.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toLearningRecord } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useLearningDomain(setData) {
  const addLearningRecord = useCallback(
    async (studentId, { subject, duration, focus, studyMethod = '', content = '' }) => {
      const actualDuration = duration
      const row = {
        id: makeId('l'),
        student_id: studentId,
        date: todayStr(),
        subject,
        duration: actualDuration,
        actual_duration: actualDuration,
        focus,
        record_type: 'timer',
        status: 'done',
        study_method: studyMethod || null,
        content,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('learning_records').insert(row),
        { label: 'addLearningRecord' }
      )
      if (error) throw error
      const record = toLearningRecord(row)
      setData((prev) => ({
        ...prev,
        learningRecords: [record, ...prev.learningRecords],
      }))
      return record
    },
    [setData]
  )

  const addLearningPlan = useCallback(
    async (studentId, { date = todayStr(), subject, studyMethod, content, plannedMin = null, sortOrder = null }) => {
      const row = {
        id: makeId('l'),
        student_id: studentId,
        date,
        subject,
        duration: null,
        actual_duration: null,
        focus: null,
        record_type: 'planner',
        status: 'pending',
        study_method: studyMethod,
        content,
        planned_min: plannedMin || null,
        sort_order: sortOrder,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('learning_records').insert(row),
        { label: 'addLearningPlan' }
      )
      if (error) throw error
      const record = toLearningRecord(row)
      setData((prev) => ({
        ...prev,
        learningRecords: [record, ...prev.learningRecords],
      }))
      return record
    },
    [setData]
  )

  const addTimerLearningRecord = useCallback(
    async (studentId, { subject, actualDuration, focus = null, studyMethod = '', content = '' }) => {
      const row = {
        id: makeId('l'),
        student_id: studentId,
        date: todayStr(),
        subject,
        duration: actualDuration,
        actual_duration: actualDuration,
        focus,
        record_type: 'timer',
        status: 'done',
        study_method: studyMethod || null,
        content,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('learning_records').insert(row),
        { label: 'addTimerLearningRecord' }
      )
      if (error) throw error
      const record = toLearningRecord(row)
      setData((prev) => ({
        ...prev,
        learningRecords: [record, ...prev.learningRecords],
      }))
      return record
    },
    [setData]
  )

  const updateLearningRecord = useCallback(
    async (recordId, patch) => {
      const snake = {}
      if (patch.subject !== undefined) snake.subject = patch.subject
      if (patch.studyMethod !== undefined) snake.study_method = patch.studyMethod || null
      if (patch.content !== undefined) snake.content = patch.content
      if (patch.plannedMin !== undefined) snake.planned_min = patch.plannedMin || null
      if (patch.sortOrder !== undefined) snake.sort_order = patch.sortOrder
      if (patch.actualDuration !== undefined) {
        snake.actual_duration = patch.actualDuration || null
        snake.duration = patch.actualDuration || null
      }
      if (patch.focus !== undefined) snake.focus = patch.focus ?? null
      if (patch.status !== undefined) snake.status = patch.status
      if (Object.keys(snake).length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('learning_records').update(snake).eq('id', recordId),
        { label: 'updateLearningRecord' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        learningRecords: prev.learningRecords.map((r) =>
          r.id === recordId
            ? toLearningRecord({
                id: r.id,
                student_id: r.studentId,
                date: r.date,
                subject: snake.subject ?? r.subject,
                duration: Object.hasOwn(snake, 'duration') ? snake.duration : r.duration ?? null,
                actual_duration: Object.hasOwn(snake, 'actual_duration') ? snake.actual_duration : r.actualDuration ?? null,
                focus: Object.hasOwn(snake, 'focus') ? snake.focus : r.focus ?? null,
                record_type: r.recordType,
                status: snake.status ?? r.status,
                study_method: Object.hasOwn(snake, 'study_method') ? snake.study_method : r.studyMethod,
                content: Object.hasOwn(snake, 'content') ? snake.content : r.content,
                planned_min: Object.hasOwn(snake, 'planned_min') ? snake.planned_min : r.plannedMin,
                sort_order: Object.hasOwn(snake, 'sort_order') ? snake.sort_order : r.sortOrder,
              })
            : r
        ),
      }))
    },
    [setData]
  )

  const reorderLearningPlans = useCallback(
    async (updates) => {
      if (!updates?.length) return
      const results = await Promise.all(updates.map(({ id, sortOrder }) =>
        withWriteRetry(
          () => supabase.from('learning_records').update({ sort_order: sortOrder }).eq('id', id),
          { label: 'reorderLearningPlans' }
        )
      ))
      const error = results.find((res) => res.error)?.error
      if (error) throw error
      const orderMap = new Map(updates.map(({ id, sortOrder }) => [id, sortOrder]))
      setData((prev) => ({
        ...prev,
        learningRecords: prev.learningRecords.map((r) =>
          orderMap.has(r.id) ? { ...r, sortOrder: orderMap.get(r.id) } : r
        ),
      }))
    },
    [setData]
  )

  const deleteLearningRecord = useCallback(
    async (recordId) => {
      const { error } = await withWriteRetry(
        () => supabase.from('learning_records').delete().eq('id', recordId),
        { label: 'deleteLearningRecord' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        learningRecords: prev.learningRecords.filter((r) => r.id !== recordId),
      }))
    },
    [setData]
  )

  const completeLearningPlan = useCallback(
    async (recordId, patch = {}) => {
      await updateLearningRecord(recordId, { ...patch, status: 'done' })
    },
    [updateLearningRecord]
  )

  return {
    addLearningRecord,
    addLearningPlan,
    addTimerLearningRecord,
    updateLearningRecord,
    reorderLearningPlans,
    deleteLearningRecord,
    completeLearningPlan,
  }
}
