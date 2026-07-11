// 도메인 CRUD 공통 팩토리 — "supabase 쓰기 + 로컬 setData 동기화" 보일러플레이트 제거.
//
// 모든 도메인 쓰기는 같은 규약을 따른다:
//   1) withWriteRetry로 supabase 쓰기 (일시적 네트워크 오류 재시도)
//   2) error면 throw — 호출부(페이지)의 try/catch 또는 전역 Toast가 표면화
//   3) 성공 시 setData로 로컬 컬렉션을 같은 모양으로 갱신 (refetch 없이 즉시 반영)
//
// 사용 예시는 workPlanDomain.js / workRecordsDomain.js 참고.
// 시그니처가 특수한 도메인(quiz/student/learning/attendance 등)은 팩토리를 억지로
// 쓰지 말고 기존처럼 직접 작성해도 된다 — 규약(위 1~3)만 지키면 된다.

import { supabase } from '../../lib/supabase.js'
import { withWriteRetry } from '../../lib/supabaseRetry.js'
import { makeId } from '../dataModel.js'

// patch(camelCase)에서 fieldMap에 선언된 키만 골라 snake_case 행으로 변환.
// fieldMap: { camelKey: 'snake_column', ... } — undefined 필드는 건너뛴다.
export function toSnakePatch(patch, fieldMap) {
  const snake = {}
  for (const [camel, column] of Object.entries(fieldMap)) {
    if (patch[camel] !== undefined) snake[column] = patch[camel]
  }
  return snake
}

// insert 팩토리. 반환 함수는 (input) => Promise.
//  - toRow(input): snake_case 행 조립 (id 제외 — makeId(prefix)로 자동 생성)
//  - toLocal(row): DB 행 → 앱 모델 변환 (lib/supabaseHelpers.js의 toXxx)
//  - created_at은 로컬 반영용으로 주입한다 (DB는 default now() 사용).
export function makeAdder(setData, { table, collection, prefix, toRow, toLocal, label }) {
  return async (input) => {
    const row = { id: makeId(prefix), ...toRow(input) }
    const { error } = await withWriteRetry(
      () => supabase.from(table).insert(row),
      { label }
    )
    if (error) throw error
    const local = toLocal({ ...row, created_at: new Date().toISOString() })
    setData((prev) => ({ ...prev, [collection]: [local, ...prev[collection]] }))
  }
}

// update 팩토리. 반환 함수는 (id, patch) => Promise. patch는 camelCase.
//  - fieldMap에 선언된 필드만 DB에 반영, 로컬에는 patch를 그대로 병합.
//  - toSnake로 변환을 커스텀할 수 있다 (예: 빈 문자열 → null 정규화).
export function makeUpdater(setData, { table, collection, fieldMap, toSnake, label }) {
  return async (id, patch) => {
    const snake = toSnake ? toSnake(patch) : toSnakePatch(patch, fieldMap)
    if (Object.keys(snake).length === 0) return
    const { error } = await withWriteRetry(
      () => supabase.from(table).update(snake).eq('id', id),
      { label }
    )
    if (error) throw error
    setData((prev) => ({
      ...prev,
      [collection]: prev[collection].map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
  }
}

// delete 팩토리. 반환 함수는 (id) => Promise.
export function makeDeleter(setData, { table, collection, label }) {
  return async (id) => {
    const { error } = await withWriteRetry(
      () => supabase.from(table).delete().eq('id', id),
      { label }
    )
    if (error) throw error
    setData((prev) => ({
      ...prev,
      [collection]: prev[collection].filter((r) => r.id !== id),
    }))
  }
}
