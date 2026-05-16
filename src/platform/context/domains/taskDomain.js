// [Write] 과제 + TODO 도메인 CRUD.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { toTodoItem } from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'

export function useTaskDomain(data, setData) {
  // 과제 완료/미완료 토글
  const toggleTask = useCallback(
    async (taskId) => {
      const task = data.tasks.find((t) => t.id === taskId)
      if (!task) return
      const newStatus = task.status === 'done' ? 'pending' : 'done'
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)
      if (error) {
        console.error('toggleTask update error:', error)
        throw error
      }
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
      const { error } = await supabase.from('todo_items').insert(row)
      if (error) {
        console.error('addTodoItem insert error:', error)
        throw error
      }
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
      const { error } = await supabase.from('todo_items').update(snake).eq('id', itemId)
      if (error) {
        console.error('updateTodoItem update error:', error)
        throw error
      }
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
      const { error } = await supabase
        .from('todo_items')
        .update({ done: newDone })
        .eq('id', itemId)
      if (error) {
        console.error('toggleTodo update error:', error)
        throw error
      }
      setData((prev) => ({
        ...prev,
        todoItems: prev.todoItems.map((t) =>
          t.id === itemId ? { ...t, done: newDone } : t
        ),
      }))
    },
    [data.todoItems, setData]
  )

  return { toggleTask, addTodoItem, updateTodoItem, toggleTodo }
}
