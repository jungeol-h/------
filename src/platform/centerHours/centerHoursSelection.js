// 그리드 선택 상태(unitKey 집합)의 순수 변환 — 컴포넌트/DOM 무의존 (vitest 대상).

import { CENTER_HOUR_UNITS, CENTER_DAY_ORDER, unitKey } from '../data/centerHours.js'

// unitKey 집합 → RPC entries [{ day, start, end }] (요일·시간 정렬 순)
export function selectionToEntries(selected) {
  const entries = []
  for (const day of CENTER_DAY_ORDER) {
    for (const unit of CENTER_HOUR_UNITS[day]) {
      if (selected.has(unitKey(day, unit.start))) {
        entries.push({ day, start: unit.start, end: unit.end })
      }
    }
  }
  return entries
}

// 요일별 등원~하원 요약 (첫 단위 시작 ~ 마지막 단위 끝) — 시간표 동기화와 같은 규칙
export function summarizeDays(selected) {
  return CENTER_DAY_ORDER.map((day) => {
    const picked = CENTER_HOUR_UNITS[day].filter((u) => selected.has(unitKey(day, u.start)))
    if (picked.length === 0) return null
    return { day, arrival: picked[0].start, departure: picked[picked.length - 1].end }
  }).filter(Boolean)
}
