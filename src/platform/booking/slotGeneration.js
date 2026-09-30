// 타임테이블 자동 생성 순수함수 (명세 5.3).
// 관리자가 운영기간·요일·일별 운영시간·시간 단위를 입력하면 슬롯 배열을 만든다.
// 운영 종료시간까지 프로그램 시간이 완전히 확보되지 않는 마지막 불완전 슬롯은
// 생성하지 않는다. 휴식·예약 불가시간과 겹치는 슬롯도 생성하지 않는다.

import { addDaysStr, minutesToTime, overlaps, timeToMinutes } from './bookingRules.js'

// params:
//   from, to        'YYYY-MM-DD' 운영기간 (양끝 포함)
//   weekdays        [0-6] 운영요일 (0=일, JS getDay 규약)
//   dayStart/dayEnd 'HH:MM' 일별 운영 시작·종료
//   slotMinutes     슬롯 시간 단위 (분)
//   capacity        슬롯별 정원
//   educatorId, subjectId, isPublic, note  슬롯 공통 속성 (선택)
//   breaks          [{ start: 'HH:MM', end: 'HH:MM' }] 휴식·예약 불가시간 (선택)
//   excludeDates    ['YYYY-MM-DD'] 휴무일 (선택)
//   blocked         [{ date, startTime, endTime, ... }] 이미 점유된 시간대 (선택) —
//                   같은 강사의 기존 슬롯(강사지정예약 포함)과 겹치는 슬롯은 만들지
//                   않는다. SQL의 _booking_generate_rule_slots와 같은 의미론.
//                   date/startTime/endTime 외 필드는 그대로 보존되므로 슬롯 객체
//                   전체를 넘기면 겹침 안내(SlotConflictList)에 재사용할 수 있다.
// 반환(generateSlots): [{ date, startTime, endTime, capacity, educatorId, subjectId, isPublic, note }]
// 반환(generateSlotsDetailed): { slots, skipped }
//   skipped: blocked 때문에 제외된 후보 [{ date, startTime, endTime, blockers }]
//            (breaks·excludeDates로 빠진 후보는 skipped에 넣지 않는다 — 사용자가
//            해소할 수 있는 '겹침'만 눈에 보이게 하려는 의도)
export function generateSlotsDetailed(params) {
  const {
    from, to, weekdays = [], dayStart, dayEnd, slotMinutes, capacity = 1,
    educatorId = null, subjectId = null, isPublic = true, note = '',
    breaks = [], excludeDates = [], blocked = [],
  } = params

  if (!from || !to || from > to) return { slots: [], skipped: [] }
  if (!slotMinutes || slotMinutes <= 0) return { slots: [], skipped: [] }

  const startMin = timeToMinutes(dayStart)
  const endMin = timeToMinutes(dayEnd)
  if (!(endMin > startMin)) return { slots: [], skipped: [] }

  const slots = []
  const skipped = []
  for (let date = from; date <= to; date = addDaysStr(date, 1)) {
    const [y, m, d] = date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay()
    if (weekdays.length > 0 && !weekdays.includes(dow)) continue
    if (excludeDates.includes(date)) continue

    for (let t = startMin; t + slotMinutes <= endMin; t += slotMinutes) {
      const startTime = minutesToTime(t)
      const endTime = minutesToTime(t + slotMinutes)
      const hitsBreak = breaks.some((b) => overlaps(startTime, endTime, b.start, b.end))
      if (hitsBreak) continue
      const blockers = blocked.filter(
        (b) => b.date === date && overlaps(startTime, endTime, b.startTime, b.endTime),
      )
      if (blockers.length > 0) {
        skipped.push({ date, startTime, endTime, blockers })
        continue
      }
      slots.push({ date, startTime, endTime, capacity, educatorId, subjectId, isPublic, note })
    }
  }
  return { slots, skipped }
}

export function generateSlots(params) {
  return generateSlotsDetailed(params).slots
}
