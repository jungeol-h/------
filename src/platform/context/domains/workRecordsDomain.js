// [Write] 업무기록 도메인 — 관리보고·재정·수업보고 CRUD.
// 업무기록 통합 탭(2026-07 클라이언트 요청)의 신규 3메뉴가 사용한다.
// 관리보고·재정은 admin 전용 작성, 수업보고는 매니저·강사·컨설턴트·admin 작성.
// 세 엔터티 모두 순수 필드 매핑 CRUD라 crudKit 팩토리로 선언한다.

import { useMemo } from 'react'
import {
  toManagementReport, toFinanceRecord, toLessonReport,
} from '../../lib/supabaseHelpers.js'
import { makeAdder, makeUpdater, makeDeleter } from './crudKit.js'

// ── 관리보고 (업무유형 6종: workRecordTypes.js WORK_TYPES) ──────
const MANAGEMENT = {
  table: 'management_reports',
  collection: 'managementReports',
  fieldMap: {
    date: 'date',
    workType: 'work_type',
    startTime: 'start_time',
    endTime: 'end_time',
    content: 'content',
    note: 'note',
    groupName: 'group_name', // 소속 그룹 태그 — null = 공용
  },
}

// ── 재정 (amount = unitPrice × quantity는 폼에서 계산해 들어온다) ──
const FINANCE = {
  table: 'finance_records',
  collection: 'financeRecords',
  fieldMap: {
    date: 'date',
    category: 'category',
    itemName: 'item_name',
    unitPrice: 'unit_price',
    quantity: 'quantity',
    amount: 'amount',
    vendor: 'vendor',
    paymentMethod: 'payment_method',
    attachments: 'attachments', // 영수증 jsonb 메타 — 실파일은 lib/financeFiles.js
    groupName: 'group_name',
  },
}

// ── 수업보고 (studentIds jsonb 최대 10명 — 폼에서 제한) ─────────
const LESSON = {
  table: 'lesson_reports',
  collection: 'lessonReports',
  fieldMap: {
    date: 'date',
    studentIds: 'student_ids',
    startTime: 'start_time',
    endTime: 'end_time',
    topic: 'topic',
    textbook: 'textbook',
    content: 'content',
    homework: 'homework',
    note: 'note',
  },
}

export function useWorkRecordsDomain(setData) {
  return useMemo(() => ({
    addManagementReport: makeAdder(setData, {
      ...MANAGEMENT, prefix: 'mr', toLocal: toManagementReport, label: 'addManagementReport',
      toRow: ({ authorId, date, workType = 'etc', startTime = '', endTime = '', content = '', note = '', groupName = null }) => ({
        author_id: authorId,
        date,
        work_type: workType,
        start_time: startTime,
        end_time: endTime,
        content,
        note,
        group_name: groupName || null,
      }),
    }),
    updateManagementReport: makeUpdater(setData, { ...MANAGEMENT, label: 'updateManagementReport' }),
    deleteManagementReport: makeDeleter(setData, { ...MANAGEMENT, label: 'deleteManagementReport' }),

    addFinanceRecord: makeAdder(setData, {
      ...FINANCE, prefix: 'fin', toLocal: toFinanceRecord, label: 'addFinanceRecord',
      toRow: ({ authorId, date, category = 'etc', itemName = '', unitPrice = 0, quantity = 1, amount = 0, vendor = '', paymentMethod = 'personal_card', attachments = [], groupName = null }) => ({
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
        group_name: groupName || null,
      }),
    }),
    updateFinanceRecord: makeUpdater(setData, { ...FINANCE, label: 'updateFinanceRecord' }),
    deleteFinanceRecord: makeDeleter(setData, { ...FINANCE, label: 'deleteFinanceRecord' }),

    addLessonReport: makeAdder(setData, {
      ...LESSON, prefix: 'lr', toLocal: toLessonReport, label: 'addLessonReport',
      toRow: ({ authorId, date, studentIds = [], startTime = '', endTime = '', topic = '', textbook = '', content = '', homework = '', note = '' }) => ({
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
      }),
    }),
    updateLessonReport: makeUpdater(setData, { ...LESSON, label: 'updateLessonReport' }),
    deleteLessonReport: makeDeleter(setData, { ...LESSON, label: 'deleteLessonReport' }),
  }), [setData])
}
