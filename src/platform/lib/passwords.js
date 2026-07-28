// 비밀번호 해시/검증 단일 구현처 — bcryptjs를 dynamic import로 지연 로드해
// 로그인·계정 생성 경로에서만 번들에 포함시킨다.
//
// 서버가 없는 구조(anon key 직접 접근)에서의 실용적 타협:
// 해시는 "DB·관리자 화면에서 평문이 보이는 것"을 막는다. anon key로 해시를
// 읽어 로그인 로직을 우회하는 것(pass-the-hash)은 RLS 부채와 함께 남는다 —
// lib/README.md 보안 부채 참조.
//
// cost 선택: 사용자가 직접 정한 비밀번호는 USER_COST(10).
// 초기 비밀번호(=전화번호)는 INITIAL_COST(8) — 전화번호는 엔트로피가 낮아
// cost를 올려도 사전공격 방어 효과가 미미하고, 일괄 등록(수십 명)의
// 클라이언트 해시 시간이 문제가 된다. 진짜 방어선은 첫 로그인 강제 재설정.

export const USER_COST = 10
export const INITIAL_COST = 8

export const PASSWORD_MIN_LENGTH = 8

const bcrypt = () => import('bcryptjs').then((m) => m.default ?? m)

// bcrypt 해시 여부 판별 — 평문/해시 전환기의 fallback 분기 기준
export const isHashed = (v) => /^\$2[aby]\$/.test(v ?? '')

export async function hashPassword(plain, cost = USER_COST) {
  const b = await bcrypt()
  return b.hash(String(plain), cost)
}

// 저장값이 해시면 bcrypt 비교, 평문(전환기 미전환 계정)이면 문자열 비교.
// 반환: { ok, wasPlaintext } — 평문 일치 시 호출부가 투명 업그레이드를 수행한다.
export async function verifyOrPlaintext(plain, stored) {
  if (!stored) return { ok: false, wasPlaintext: false }
  if (isHashed(stored)) {
    const b = await bcrypt()
    return { ok: await b.compare(String(plain), stored), wasPlaintext: false }
  }
  return { ok: String(plain) === stored, wasPlaintext: true }
}

// 새 비밀번호 규칙 검사. 통과하면 null, 실패하면 에러 문구 반환.
// forbidden: 초기값(본인 전화번호 등)과 동일 금지 목록
export function validateNewPassword(pw, { forbidden = [] } = {}) {
  const v = String(pw ?? '')
  if (v.length < PASSWORD_MIN_LENGTH) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`
  if (/\s/.test(v)) return '비밀번호에 공백은 쓸 수 없습니다.'
  if (forbidden.filter(Boolean).includes(v)) return '전화번호는 비밀번호로 쓸 수 없습니다. 다른 비밀번호를 정해주세요.'
  return null
}
