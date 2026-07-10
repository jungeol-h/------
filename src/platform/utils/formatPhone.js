// 전화번호 표시 포맷 — 010XXXXXXXX(11자리) → 010-XXXX-XXXX.
// 학생 목록 연락처 컬럼용. 현재 학생 연락처는 users.password(010+8자리),
// 학부모 연락처는 users.parent_password에 저장돼 있어 파생 표시한다.
// (연락처와 비밀번호를 분리 운영하려면 별도 컬럼 신설 필요)
export function formatPhone(raw) {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return String(raw)
}
