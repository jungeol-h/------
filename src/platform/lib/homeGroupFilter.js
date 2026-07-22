// 관리자 홈 '출결 집계' 그룹 필터 설정 — admin_config에 사용자별로 저장.
// key는 `home_group_filter:<userId>`로 관리자마다 자기 선택을 따로 유지한다.
// value: { groups: string[] } — 빈 배열이면 '전체 그룹' 의미로 해석(선택 안 함).
// centerHoursApi의 admin_config upsert 패턴을 따른다.

import { supabase } from './supabase.js'

const keyFor = (userId) => `home_group_filter:${userId || 'unknown'}`

// 저장된 그룹 목록 조회. 미설정이면 null (호출부가 기본값 결정).
export async function fetchHomeGroupFilter(userId) {
  const { data, error } = await supabase
    .from('admin_config')
    .select('value')
    .eq('key', keyFor(userId))
    .maybeSingle()
  if (error) throw error
  const groups = data?.value?.groups
  return Array.isArray(groups) ? groups : null
}

// 그룹 목록 저장 (upsert).
export async function saveHomeGroupFilter(userId, groups) {
  const { error } = await supabase
    .from('admin_config')
    .upsert({ key: keyFor(userId), value: { groups } }, { onConflict: 'key' })
  if (error) throw error
  return groups
}
