// 그룹(소속) 열람 판정 순수함수 — fetch단 스코프 필터(fetchForAdmin 등)에서 사용.
//
// 규약:
//  - 열람자 그룹이 NULL/빈 배열이면 전체 열람 (admin, 백필 전 계정의 안전 기본값)
//  - 대상(학생)·기록의 그룹이 없으면 공용 취급 — 누구에게나 보인다
//    (그룹 미지정 신규 학생이 모든 직원 화면에서 사라지는 사고 방지)

const isUnscoped = (groups) => !Array.isArray(groups) || groups.length === 0

// 열람자(viewerGroups: 배열)가 대상(targetGroups: 배열)을 볼 수 있는가 — 교집합 판정
export function canViewByGroups(viewerGroups, targetGroups) {
  if (isUnscoped(viewerGroups) || isUnscoped(targetGroups)) return true
  return targetGroups.some((g) => viewerGroups.includes(g))
}

// 기록의 단일 group_name 판정 — null/빈 문자열이면 공용
export function canViewRecordGroup(viewerGroups, groupName) {
  if (isUnscoped(viewerGroups) || !groupName) return true
  return viewerGroups.includes(groupName)
}
