// 출결 엑셀 추출용 순수 그리드 빌더 — DOM/exceljs 의존 없음.
// 월별 파일 > 주별 시트 > 시간대 행 × 날짜 열 구조의 데이터 모델을 구성한다.
//
// buildAttendanceGrid({ records, students, year, month, slotMinutes, startMinutes, endMinutes })
// - records: [{ studentId, date:'YYYY-MM-DD', status, checkInAt, checkoutStatus }]
//   checkInAt 없는 레코드(결석 등)는 제외한다.
// - students: [{ id, name, school, grade }]
// - year, month(1~12): 대상 월
// - slotMinutes: 시간대 버킷 크기(분). 예 30, 60, 120
// - startMinutes, endMinutes: 하루 중 버킷 범위(분, 00:00 기준). 예 540(09:00)~1320(22:00)
//
// 반환:
// { weeks: [ { name:'1주차', days:[{date,label}...], rows:[{slotLabel, cells:[{entries:[{text,tags}]}]}] } ] }

const DOW_KR = ['일', '월', '화', '수', '목', '금', '토']

// 로컬(브라우저=KST) 기준 분 단위 시각 (00:00부터 경과 분)
function localMinutesOfDay(iso) {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

// 로컬 기준 'YYYY-MM-DD'
function localDateKey(iso) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function minutesToLabel(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${pad2(h)}:${pad2(m)}`
}

// 월요일 시작 요일 인덱스 (월=0 ... 일=6)
function mondayIndex(jsDay) {
  return (jsDay + 6) % 7
}

// 대상 월의 주차 목록 구성. 각 주는 월~일 7일.
// 1일이 속한 주(그 주의 월요일)부터, 월의 마지막 날을 포함하는 주까지.
// 각 날짜는 대상 월 밖이면 null 처리(빈 열).
function buildWeeks(year, month) {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0) // 이 달의 마지막 날
  const lastDate = last.getDate()

  // 첫 주의 월요일로 이동
  const weekStart = new Date(first)
  weekStart.setDate(first.getDate() - mondayIndex(first.getDay()))

  const weeks = []
  const cursor = new Date(weekStart)
  let weekNo = 1

  while (true) {
    const days = []
    let hasInMonth = false
    for (let i = 0; i < 7; i++) {
      const inMonth = cursor.getFullYear() === year && cursor.getMonth() === month - 1
      if (inMonth) {
        hasInMonth = true
        const dateKey = `${year}-${pad2(month)}-${pad2(cursor.getDate())}`
        const label = `${month}/${cursor.getDate()}(${DOW_KR[cursor.getDay()]})`
        days.push({ date: dateKey, label })
      } else {
        days.push({ date: null, label: '' })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    if (hasInMonth) {
      weeks.push({ name: `${weekNo}주차`, days })
      weekNo++
    }
    // 커서가 이 달을 완전히 지났으면 종료
    if (
      cursor.getFullYear() > year ||
      (cursor.getFullYear() === year && cursor.getMonth() > month - 1) ||
      (cursor.getFullYear() === year && cursor.getMonth() === month - 1 && cursor.getDate() > lastDate)
    ) {
      break
    }
  }
  return weeks
}

// 시간대 슬롯 목록 [start, end) 구성
function buildSlots(startMinutes, endMinutes, slotMinutes) {
  const slots = []
  for (let s = startMinutes; s < endMinutes; s += slotMinutes) {
    const e = Math.min(s + slotMinutes, endMinutes)
    slots.push({ start: s, end: e, label: `${minutesToLabel(s)}~${minutesToLabel(e)}` })
  }
  return slots
}

function buildTags(rec) {
  const tags = []
  if (rec.status === 'late') tags.push('지각')
  if (rec.checkoutStatus === 'early_leave') tags.push('조퇴')
  return tags
}

export function buildAttendanceGrid({
  records = [],
  students = [],
  year,
  month,
  slotMinutes = 30,
  startMinutes = 540,
  endMinutes = 1320,
}) {
  const studentById = new Map(students.map((s) => [s.id, s]))
  const weeks = buildWeeks(year, month)
  const slots = buildSlots(startMinutes, endMinutes, slotMinutes)

  // (dateKey, slotIndex) → entries[]
  const bucket = new Map()
  const keyOf = (dateKey, slotIdx) => `${dateKey}#${slotIdx}`

  for (const rec of records) {
    if (!rec.checkInAt) continue // 결석 등 등원기록 없는 레코드 제외
    const mins = localMinutesOfDay(rec.checkInAt)
    if (mins < startMinutes || mins >= endMinutes) continue
    const slotIdx = slots.findIndex((sl) => mins >= sl.start && mins < sl.end)
    if (slotIdx === -1) continue
    const dateKey = localDateKey(rec.checkInAt)
    const student = studentById.get(rec.studentId)
    const name = student?.name ?? '(알수없음)'
    const school = student?.school ?? ''
    const grade = student?.grade ?? ''
    const meta = [school, grade].filter(Boolean).join('/')
    const text = meta ? `${name}(${meta})` : name
    const k = keyOf(dateKey, slotIdx)
    if (!bucket.has(k)) bucket.set(k, [])
    bucket.get(k).push({ text, tags: buildTags(rec) })
  }

  const weeksOut = weeks.map((wk) => ({
    name: wk.name,
    days: wk.days,
    rows: slots.map((sl, slotIdx) => ({
      slotLabel: sl.label,
      cells: wk.days.map((day) => ({
        entries: day.date ? (bucket.get(keyOf(day.date, slotIdx)) ?? []) : [],
      })),
    })),
  }))

  return { weeks: weeksOut }
}

export const __test__ = { buildWeeks, buildSlots, localMinutesOfDay, localDateKey }
