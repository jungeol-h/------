// 계정 이중화 없이 관리자 계정이 강사 화면으로 들어가는 "보기 모드" 매핑 — 프론트 상수
// (DB 변경 없음). 앱 전체가 currentUser.role 한 필드로 분기하므로, AuthContext가
// 보기 모드일 때만 role을 덮어쓴 currentUser를 내보낸다(저장된 세션의 role은 그대로).
//
// 2026-09-30 클라이언트 요청: 황광희(a-hwang, DB role=admin)가 강사 대시보드로도 접속.
// 상담·수업보고·예약 슬롯이 모두 a-hwang id에 묶여 있어 별도 강사 계정을 만들지 않는다.
//
// extraTabs: 전환된 역할에 기본으로 없는 탭 — 'external'(외부상담)은 본래 consultant 전용.
// test-admin(테스트관리자)은 실사용자 계정 없이 이 기능을 검증하기 위한 항목이다.

export const EDUCATOR_VIEWS = {
  'a-hwang': { role: 'instructor', extraTabs: ['external'] },
  'test-admin': { role: 'instructor', extraTabs: ['external'] },
}

// 강사 화면으로 전환 가능한 계정이면 설정, 아니면 null.
export function educatorViewOf(user) {
  if (!user) return null
  return EDUCATOR_VIEWS[user.id] ?? null
}

// 보기 모드를 반영한 user. 'educator'이고 전환 가능 계정일 때만 role을 덮어쓰며
// (DB role은 accountRole에 보존), 그 외에는 같은 객체를 그대로 돌려준다.
export function applyRoleView(user, viewMode) {
  if (viewMode !== 'educator') return user
  const cfg = educatorViewOf(user)
  if (!cfg) return user
  return { ...user, role: cfg.role, accountRole: user.role, educatorExtraTabs: cfg.extraTabs }
}
