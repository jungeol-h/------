// 학생 중복 등록 판정 순수함수 — 신규 등록 전에 기존 학생(퇴원·신청취소 포함
// 전체 상태)과 대조한다. 2026-07 실데이터에서 이름 오타·아이디 변형으로
// login_id 검사만 뚫고 동일인이 5쌍 중복 등록된 사고의 재발 방지용.
//
// 판정 근거는 전화번호가 최우선이다: 비밀번호 = 학생 전화번호, 학부모
// 비밀번호 = 학부모 전화번호 관례이므로 번호 일치는 이름이 달라도(오타)
// 동일인일 가능성이 높다. 이름만 같은 것은 동명이인일 수 있어 약한 신호.

import { STUDENT_STATUS_LABELS } from '../data/studentStatus.js'

// 일괄 등록에서 전화번호 형식 오류 시 넣는 자리표시 비밀번호 — 번호 비교에서 제외
export const PLACEHOLDER_PHONE = '00000000000'

const validPhone = (v) => v && v !== PLACEHOLDER_PHONE && /^010\d{8}$/.test(v)

// students: 관리자 컨텍스트의 전체 학생(toUser 형태, 퇴원·취소 포함 — fetchForAdmin이 보장)
// input: { name, password, parentPassword, excludeId? } — 정규화된 값(cleanText/normalizePhone 후)
// 반환: [{ student, reasons: string[], samePerson: boolean }] — samePerson=true 는
//   동일인 가능성이 높은 매치(학생 번호 일치, 또는 이름+학부모 번호 일치)
export function findDuplicateStudents(students, { name, password, parentPassword, excludeId } = {}) {
  const matches = []
  for (const s of students ?? []) {
    if (s.role !== 'student' && s.role !== undefined) continue
    if (excludeId && s.id === excludeId) continue

    const phoneHit = validPhone(password) && s.password === password
    const parentHit = validPhone(parentPassword) && s.parentPassword === parentPassword
    const nameHit = !!name && s.name === name

    if (!phoneHit && !parentHit && !nameHit) continue

    const reasons = []
    if (phoneHit) reasons.push('학생 전화번호 일치')
    if (parentHit) reasons.push('학부모 전화번호 일치')
    if (nameHit) reasons.push('이름 일치')

    matches.push({
      student: s,
      reasons,
      // 학부모 번호만 일치는 형제자매, 이름만 일치는 동명이인일 수 있다
      samePerson: phoneHit || (nameHit && parentHit),
    })
  }
  // 동일인 유력 매치를 앞에
  return matches.sort((a, b) => Number(b.samePerson) - Number(a.samePerson))
}

// 경고 문구용 한 줄 요약: "강은성 · 안동여중 중2 · 퇴원 — 학생 전화번호 일치"
export function describeDuplicate({ student, reasons }) {
  const where = [student.school, student.grade].filter(Boolean).join(' ')
  const statusLabel = STUDENT_STATUS_LABELS[student.status] ?? student.status
  return `${student.name}${where ? ` · ${where}` : ''} · ${statusLabel} — ${reasons.join(', ')}`
}
