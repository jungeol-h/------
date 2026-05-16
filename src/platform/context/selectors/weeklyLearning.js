// [Read] 최근 7일 학습시간 집계 — data를 인자로 받는 순수함수

// Date → 'YYYY-MM-DD' 로컬 날짜 문자열. toISOString()은 UTC로 변환되어
// 한국 시간대(UTC+9)에서 자정 무렵 날짜가 하루 밀리므로 쓰지 않는다.
export function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 오늘 기준 최근 7일의 날짜 문자열(YYYY-MM-DD) 배열. 과거→오늘 순.
export function lastSevenDays(today = new Date()) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(toDateStr(d))
  }
  return days
}

// 한 학생의 최근 7일 일별 학습시간 합계. [{ day: 'MM-DD', minutes }]
export function getWeeklyLearning(data, studentId, today = new Date()) {
  return lastSevenDays(today).map((date) => {
    const minutes = data.learningRecords
      .filter((r) => r.studentId === studentId && r.date === date)
      .reduce((sum, r) => sum + (r.duration ?? 0), 0)
    return { day: date.slice(5), minutes }
  })
}
