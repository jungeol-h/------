// 전화번호 표시 포맷 — 010XXXXXXXX(11자리) → 010-XXXX-XXXX.
// 학생 연락처는 users.phone, 학부모 연락처는 users.parent_phone에 저장된다
// (add-password-security.sql에서 비밀번호 겸용이던 컬럼과 분리됨).
export function formatPhone(raw) {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return String(raw)
}
