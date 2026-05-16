// [Read] 분석 지표 산출 — data를 인자로 받는 순수함수
//
// docs/3. 자료/개념 정리/유저 개념/학습자/학생.md 의 자기주도지수 공식 구현.
// 공식: (1일 학습시간 점수) + (자가평가 점수) 합산 50점 만점 → 백분위 환산.
//
// 한계: docs는 자가평가 4종(학습량/집중도/만족도/효율성, 각 10점)을 명시하지만
// 현재 learningRecords에는 focus(집중도) 1종만 존재한다. 가용 데이터로 공식을
// 충실히 구현하되, 자가평가는 focus 단일 항목으로 산출한다. 나머지 3종이
// 스키마에 추가되면 selfEvalScore()만 확장하면 된다.

// 하루 총 학습시간(분) → 학습시간 점수(0~10). docs 학생.md 구간표.
export function learningTimeScore(totalMinutes) {
  if (totalMinutes >= 240) return 10  // 4시간 이상
  if (totalMinutes > 210) return 9    // 3시간30분 초과
  if (totalMinutes > 180) return 9    // 3시간 초과
  if (totalMinutes > 150) return 7    // 2시간30분 초과
  if (totalMinutes > 120) return 5    // 2시간 초과
  if (totalMinutes > 90) return 3     // 1시간30분 초과
  if (totalMinutes >= 60) return 1    // 1시간 이상
  return 0
}

// 하루 학습기록들의 자가평가 점수(0~10). 현재는 집중도(focus 0~100%)를 10점 환산.
export function selfEvalScore(dayRecords) {
  if (dayRecords.length === 0) return 0
  const avgFocus = dayRecords.reduce((s, r) => s + (r.focus ?? 0), 0) / dayRecords.length
  return Math.round((avgFocus / 100) * 10)
}

// 하루치 자기주도 점수(0~20점): 학습시간 점수 + 자가평가 점수.
export function dailySelfDirectedScore(dayRecords) {
  const totalMin = dayRecords.reduce((s, r) => s + (r.duration ?? 0), 0)
  return learningTimeScore(totalMin) + selfEvalScore(dayRecords)
}

// 한 학생의 자기주도지수(0~100). 최근 학습기록 있는 날들의 일평균 점수를
// 20점 만점 기준 백분위로 환산. 기록이 없으면 null(미산출).
export function getSelfDirectedIndex(data, studentId) {
  const records = data.learningRecords.filter((r) => r.studentId === studentId)
  if (records.length === 0) return null

  const byDate = {}
  records.forEach((r) => {
    (byDate[r.date] ??= []).push(r)
  })

  const dayScores = Object.values(byDate).map(dailySelfDirectedScore)
  const avg = dayScores.reduce((s, n) => s + n, 0) / dayScores.length
  return Math.round((avg / 20) * 100)
}

// 정서 안정도(0~100) — 마인드 기록(mood/motivation/confidence 각 -5~5,
// 합산 -15~15)의 평균을 백분위 환산. docs 통계.md "정서 안정도" 지표.
export function getEmotionStability(data, studentId) {
  const records = data.mindRecords.filter((r) => r.studentId === studentId)
  if (records.length === 0) return null

  const totals = records.map(
    (r) => (r.mood ?? 0) + (r.motivation ?? 0) + (r.confidence ?? 0)
  )
  const avg = totals.reduce((s, n) => s + n, 0) / totals.length
  // -15~15 → 0~100
  return Math.round(((avg + 15) / 30) * 100)
}
