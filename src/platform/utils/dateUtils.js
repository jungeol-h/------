// 날짜 문자열 유틸 — 앱 전역에서 'YYYY-MM-DD'는 항상 **로컬(KST) 기준**이다.
//
// 주의: `new Date().toISOString().slice(0, 10)`은 UTC 날짜라서 한국 시간
// 00:00~09:00 사이에 전날 날짜가 나온다 (베타 운영 중 실제로 겪은 버그).
// 날짜 문자열이 필요하면 반드시 이 파일의 함수를 쓸 것.

// Date → 'YYYY-MM-DD' 로컬 날짜 문자열.
export function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 오늘의 로컬 날짜 문자열. 도메인 CRUD의 date 컬럼 기본값으로 사용.
export function todayStr() {
  return toDateStr(new Date())
}

// n일 전 로컬 날짜 문자열. fetcher의 조회 윈도(최근 60일 등) 경계 계산용.
export function daysAgoStr(n, from = new Date()) {
  return toDateStr(new Date(from.getFullYear(), from.getMonth(), from.getDate() - n))
}
