// [Write] 업무기록 도메인 — 관리보고·재정·수업보고 CRUD.
// 업무기록 통합 탭(2026-07 클라이언트 요청)의 신규 3메뉴가 사용한다.
// 관리보고·재정은 admin 전용 작성, 수업보고는 매니저·강사·컨설턴트·admin 작성.

import { useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import {
  toManagementReport, toFinanceRecord, toLessonReport,
} from '../../lib/supabaseHelpers.js'
import { makeId } from '../dataModel.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'

export function useWorkRecordsDomain(setData) {
  // ── 관리보고 ────────────────────────────────────────────────
  const addManagementReport = useCallback(
    async ({ authorId, date, workType = 'etc', startTime = '', endTime = '', content = '', note = '' }) => {
      const row = {
        id: makeId('mr'),
        author_id: authorId,
        date,
        work_type: workType,
        start_time: startTime,
        end_time: endTime,
        content,
        note,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('management_reports').insert(row),
        { label: 'addManagementReport' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        managementReports: [toManagementReport({ ...row, created_at: new Date().toISOString() }), ...prev.managementReports],
      }))
    },
    [setData]
  )

  const updateManagementReport = useCallback(
    async (id, patch) => {
      const snake = {}
      if (patch.date !== undefined) snake.date = patch.date
      if (patch.workType !== undefined) snake.work_type = patch.workType
      if (patch.startTime !== undefined) snake.start_time = patch.startTime
      if (patch.endTime !== undefined) snake.end_time = patch.endTime
      if (patch.content !== undefined) snake.content = patch.content
      if (patch.note !== undefined) snake.note = patch.note
      if (Object.keys(snake).length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('management_reports').update(snake).eq('id', id),
        { label: 'updateManagementReport' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        managementReports: prev.managementReports.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }))
    },
    [setData]
  )

  const deleteManagementReport = useCallback(
    async (id) => {
      const { error } = await withWriteRetry(
        () => supabase.from('management_reports').delete().eq('id', id),
        { label: 'deleteManagementReport' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        managementReports: prev.managementReports.filter((r) => r.id !== id),
      }))
    },
    [setData]
  )

  // ── 재정 ────────────────────────────────────────────────────
  const addFinanceRecord = useCallback(
    async ({ authorId, date, category = 'etc', itemName = '', unitPrice = 0, quantity = 1, amount = 0, vendor = '', paymentMethod = 'personal_card', attachments = [] }) => {
      const row = {
        id: makeId('fin'),
        author_id: authorId,
        date,
        category,
        item_name: itemName,
        unit_price: unitPrice,
        quantity,
        amount,
        vendor,
        payment_method: paymentMethod,
        attachments,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('finance_records').insert(row),
        { label: 'addFinanceRecord' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        financeRecords: [toFinanceRecord({ ...row, created_at: new Date().toISOString() }), ...prev.financeRecords],
      }))
    },
    [setData]
  )

  const updateFinanceRecord = useCallback(
    async (id, patch) => {
      const snake = {}
      if (patch.date !== undefined) snake.date = patch.date
      if (patch.category !== undefined) snake.category = patch.category
      if (patch.itemName !== undefined) snake.item_name = patch.itemName
      if (patch.unitPrice !== undefined) snake.unit_price = patch.unitPrice
      if (patch.quantity !== undefined) snake.quantity = patch.quantity
      if (patch.amount !== undefined) snake.amount = patch.amount
      if (patch.vendor !== undefined) snake.vendor = patch.vendor
      if (patch.paymentMethod !== undefined) snake.payment_method = patch.paymentMethod
      if (patch.attachments !== undefined) snake.attachments = patch.attachments
      if (Object.keys(snake).length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('finance_records').update(snake).eq('id', id),
        { label: 'updateFinanceRecord' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        financeRecords: prev.financeRecords.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }))
    },
    [setData]
  )

  const deleteFinanceRecord = useCallback(
    async (id) => {
      const { error } = await withWriteRetry(
        () => supabase.from('finance_records').delete().eq('id', id),
        { label: 'deleteFinanceRecord' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        financeRecords: prev.financeRecords.filter((r) => r.id !== id),
      }))
    },
    [setData]
  )

  // ── 수업보고 ────────────────────────────────────────────────
  const addLessonReport = useCallback(
    async ({ authorId, date, studentIds = [], startTime = '', endTime = '', topic = '', textbook = '', content = '', homework = '', note = '' }) => {
      const row = {
        id: makeId('lr'),
        author_id: authorId,
        date,
        student_ids: studentIds,
        start_time: startTime,
        end_time: endTime,
        topic,
        textbook,
        content,
        homework,
        note,
      }
      const { error } = await withWriteRetry(
        () => supabase.from('lesson_reports').insert(row),
        { label: 'addLessonReport' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        lessonReports: [toLessonReport({ ...row, created_at: new Date().toISOString() }), ...prev.lessonReports],
      }))
    },
    [setData]
  )

  const updateLessonReport = useCallback(
    async (id, patch) => {
      const snake = {}
      if (patch.date !== undefined) snake.date = patch.date
      if (patch.studentIds !== undefined) snake.student_ids = patch.studentIds
      if (patch.startTime !== undefined) snake.start_time = patch.startTime
      if (patch.endTime !== undefined) snake.end_time = patch.endTime
      if (patch.topic !== undefined) snake.topic = patch.topic
      if (patch.textbook !== undefined) snake.textbook = patch.textbook
      if (patch.content !== undefined) snake.content = patch.content
      if (patch.homework !== undefined) snake.homework = patch.homework
      if (patch.note !== undefined) snake.note = patch.note
      if (Object.keys(snake).length === 0) return
      const { error } = await withWriteRetry(
        () => supabase.from('lesson_reports').update(snake).eq('id', id),
        { label: 'updateLessonReport' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        lessonReports: prev.lessonReports.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }))
    },
    [setData]
  )

  const deleteLessonReport = useCallback(
    async (id) => {
      const { error } = await withWriteRetry(
        () => supabase.from('lesson_reports').delete().eq('id', id),
        { label: 'deleteLessonReport' }
      )
      if (error) throw error
      setData((prev) => ({
        ...prev,
        lessonReports: prev.lessonReports.filter((r) => r.id !== id),
      }))
    },
    [setData]
  )

  return {
    addManagementReport, updateManagementReport, deleteManagementReport,
    addFinanceRecord, updateFinanceRecord, deleteFinanceRecord,
    addLessonReport, updateLessonReport, deleteLessonReport,
  }
}
