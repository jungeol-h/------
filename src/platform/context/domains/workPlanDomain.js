// [Write] 업무계획 도메인 — 관리자 일정 CRUD (일시(시작~종료)/업무유형/대상/메모/진행상태).
// types·audiences는 jsonb 배열 (유형 중복 체크, 대상 복수선택 — WORK_PLAN_AUDIENCES).
// studentIds는 2026-07-30 개편 전 구 기록 호환용으로 매핑만 유지 (신규 폼은 안 보냄).
// status: planned → in_progress → done (WorkPlanTab 카드 배지 클릭으로 순환).

import { useMemo } from 'react'
import { toWorkPlan } from '../../lib/supabaseHelpers.js'
import { makeAdder, makeUpdater, makeDeleter } from './crudKit.js'

const TABLE = 'work_plans'
const COLLECTION = 'workPlans'

const FIELD_MAP = {
  planDate: 'plan_date',
  planTime: 'plan_time',
  planEndTime: 'plan_end_time',
  types: 'types',
  studentIds: 'student_ids', // 구 데이터 호환 — 폼은 더 이상 안 보냄
  audiences: 'audiences',
  memo: 'memo',
  status: 'status',
}

export function useWorkPlanDomain(setData) {
  return useMemo(() => ({
    addWorkPlan: makeAdder(setData, {
      table: TABLE, collection: COLLECTION, prefix: 'wp', toLocal: toWorkPlan,
      label: 'addWorkPlan',
      toRow: ({ authorId, planDate, planTime = '', planEndTime = '', types = [], audiences = [], memo = '' }) => ({
        author_id: authorId,
        plan_date: planDate,
        plan_time: planTime,
        plan_end_time: planEndTime,
        types,
        student_ids: [], // 2026-07-30 개편: 학생 특정 없음 (구체적 대상은 메모에)
        audiences,
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
