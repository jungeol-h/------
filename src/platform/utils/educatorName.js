// 교직원 표시명 — users.subject(담당 과목/분야)가 있으면 '이름(과목)'으로 병기.
// 상담 기록 작성자 표시(카드·PDF) 공용. educator가 없으면 null — 호출부에서 폴백 처리.
export function educatorDisplayName(educator) {
  if (!educator) return null
  return educator.subject ? `${educator.name}(${educator.subject})` : educator.name
}
