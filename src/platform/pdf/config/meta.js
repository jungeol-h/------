export const ORG_NAME = '나르샤'
export const ORG_SUBTITLE = '안동시 자기주도학습·진로성장 관리 시스템'

export const ROLE_LABEL = {
  admin: '관리자',
  manager: '학습매니저',
  student: '학생',
  parent: '학부모',
  instructor: '강사',
  consultant: '컨설턴트',
}

export function authorOf(user) {
  if (!user) return '미상'
  const role = ROLE_LABEL[user.role] || user.role || ''
  return role ? `${role} ${user.name}` : user.name
}
