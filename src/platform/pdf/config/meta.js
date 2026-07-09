export const ORG_NAME = '나매크'
export const ORG_SUBTITLE = '자기주도학습·진로성장 관리 시스템'

export const ROLE_LABEL = {
  admin: '관리자',
  manager: '학습매니저',
  student: '학생',
  parent: '학부모',
  instructor: '교과강사',
  consultant: '컨설턴트',
  viewer: '열람자',
}

export function authorOf(user) {
  if (!user) return '미상'
  const role = ROLE_LABEL[user.role] || user.role || ''
  return role ? `${role} ${user.name}` : user.name
}
