// [Write] 과제 + TODO 도메인 CRUD.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toTodoItem, toTask } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

export function useTaskDomain(data, setData) {
  // 과제 완료/미완료 토글
  const toggleTask = useCallback(
    async (taskId) => {
      const task = data.tasks.find((t) => t.id === taskId)
      if (!task) return
      const newStatus = task.status === 'done' ? 'pending' : 'done'
      const { error } = await withWriteRetry(
        () => supabase.from('tasks').update({ status: newStatus }).eq('id', taskId),
        { label: 'toggleTask' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        ),
      }))
    },
    [data.tasks, setData]
  )

  // TODO 아이템 추가
  const addTodoItem = useCallback(
    async (studentId, { subject, plannedMin, content = '' }) => {
      const row = {
        id: makeId('td'),
        student_id: studentId,
        date: new Date().toISOString().slice(0, 10),
        subject,
        planned_min: plannedMin,
        content,
        done: false,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('todo_items').insert(row),
        { label: 'addTodoItem' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        todoItems: [toTodoItem(row), ...prev.todoItems],
      }))
    },
    [setData]
  )

  // TODO 아이템 수정 (학습 내용 보완 등)
  const updateTodoItem = useCallback(
    async (itemId, patch) => {
      const snake = {}
      if (patch.subject !== undefined) snake.subject = patch.subject
      if (patch.plannedMin !== undefined) snake.planned_min = patch.plannedMin
      if (patch.content !== undefined) snake.content = patch.content
      if (Object.keys(snake).length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('todo_items').update(snake).eq('id', itemId),
        { label: 'updateTodoItem' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        todoItems: prev.todoItems.map((t) =>
          t.id === itemId ? { ...t, ...patch } : t
        ),
      }))
    },
    [setData]
  )

  // TODO 완료 토글
  const toggleTodo = useCallback(
    async (itemId) => {
      const item = data.todoItems.find((t) => t.id === itemId)
      if (!item) return
      const newDone = !item.done
      const { error } = await withWriteRetry(
        () => supabase.from('todo_items').update({ done: newDone }).eq('id', itemId),
        { label: 'toggleTodo' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        todoItems: prev.todoItems.map((t) =>
          t.id === itemId ? { ...t, done: newDone } : t
        ),
      }))
    },
    [data.todoItems, setData]
  )

  // 과제 부여 (교과강사/컨설턴트/매니저/관리자가 학생에게 과제 배정)
  const addTask = useCallback(
    async ({ studentId, title, subject, dueDate, dueTime, assignerId, assignerName, method, content }) => {
      const row = {
        id: makeId('t'),
        student_id: studentId,
        title,
        subject,
        due_date: dueDate,
        due_time: dueTime || '23:59',
        status: 'pending',
        assigner_id: assignerId ?? null,
        assigner_name: assignerName ?? null,
        method: method || null,
        content: content || null,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('tasks').insert(row),
        { label: 'addTask' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        tasks: [toTask(row), ...prev.tasks],
      }))
    },
    [setData]
  )

  // 과제 수정 (제목/과목/마감일/마감시간/수행방법/과제 내용)
  const updateTask = useCallback(
    async (id, patch) => {
      const snake = {}
      if (patch.title !== undefined) snake.title = patch.title
      if (patch.subject !== undefined) snake.subject = patch.subject
      if (patch.dueDate !== undefined) snake.due_date = patch.dueDate
      if (patch.dueTime !== undefined) snake.due_time = patch.dueTime
      if (patch.method !== undefined) snake.method = patch.method || null
      if (patch.content !== undefined) snake.content = patch.content || null
      if (Object.keys(snake).length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('tasks').update(snake).eq('id', id),
        { label: 'updateTask' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      }))
    },
    [setData]
  )

  // 과제 삭제
  const deleteTask = useCallback(
    async (id) => {
      const { error } = await withWriteRetry(
        () => supabase.from('tasks').delete().eq('id', id),
        { label: 'deleteTask' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
      }))
    },
    [setData]
  )

  return { toggleTask, addTask, updateTask, deleteTask, addTodoItem, updateTodoItem, toggleTodo }
}
