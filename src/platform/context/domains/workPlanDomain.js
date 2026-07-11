// [Write] 업무계획 도메인 — 관리자 일정 CRUD (일시/업무유형/대상학생/메모/진행상태).
// types·studentIds는 jsonb 배열 (유형 중복 체크, 대상 학생 복수 허용).
// status: planned → in_progress → done (WorkPlanTab 카드 배지 클릭으로 순환).

import { useMemo } from 'react'
import { toWorkPlan } from '../../lib/supabaseHelpers.js'
import { makeAdder, makeUpdater, makeDeleter } from './crudKit.js'

const TABLE = 'work_plans'
const COLLECTION = 'workPlans'

const FIELD_MAP = {
  planDate: 'plan_date',
  planTime: 'plan_time',
  types: 'types',
  studentIds: 'student_ids',
  memo: 'memo',
  status: 'status',
}

export function useWorkPlanDomain(setData) {
  return useMemo(() => ({
    addWorkPlan: makeAdder(setData, {
      table: TABLE, collection: COLLECTION, prefix: 'wp', toLocal: toWorkPlan,
      label: 'addWorkPlan',
      toRow: ({ authorId, planDate, planTime = '', types = [], studentIds = [], memo = '' }) => ({
        author_id: authorId,
        plan_date: planDate,
        plan_time: planTime,
        types,
        student_ids: studentIds,
        memo,
        status: 'planned',
      }),
    }),
    updateWorkPlan: makeUpdater(setData, {
      table: TABLE, collection: COLLECTION, fieldMap: FIELD_MAP, label: 'updateWorkPlan',
    }),
    deleteWorkPlan: makeDeleter(setData, {
      table: TABLE, collection: COLLECTION, label: 'deleteWorkPlan',
    }),
  }), [setData])
}
