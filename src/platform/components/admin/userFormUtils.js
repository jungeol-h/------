// 사용자 계정 폼(StudentFormModal·EducatorFormModal) 공용 정규화·검증 헬퍼.
// 컴포넌트 파일에서 export하면 react-refresh 규칙에 걸리므로 별도 모듈로 둔다.

export const LOGIN_ID_RE = /^[가-힣A-Za-z0-9_]+$/

// 보이지 않는 문자(ZWSP/ZWNJ/ZWJ/BOM/NBSP) 제거 + 양 끝 공백 trim
// (ZWJ는 character class에 넣으면 결합 시퀀스로 오인되므로 alternation 사용)
const INVISIBLE_RE = new RegExp('\\u200B|\\u200C|\\u200D|\\uFEFF|\\u00A0', 'g')
export const cleanText = (v) => (v ?? '').replace(INVISIBLE_RE, '').trim()

// 전화번호 정규화: 전각숫자→반각, 숫자 외 모두 제거
const FULLWIDTH_DIGITS = /[０-９]/g
const toHalfDigit = (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
export const normalizePhone = (v) =>
  (v ?? '').replace(FULLWIDTH_DIGITS, toHalfDigit).replace(/\D/g, '')
export const isValidPhone = (v) => /^010\d{8}$/.test(v)

// Supabase 에러 메시지 한국어화
export function humanizeSupabaseError(err) {
  if (!err) return '저장 중 오류가 발생했습니다.'
  const code = err.code
  const msg = err.message || ''
  if (code === '23505' || /duplicate key/i.test(msg)) {
    if (/users_student_name_phone/i.test(msg)) {
      return '같은 이름·전화번호의 학생이 이미 있습니다(퇴원·신청취소 포함). 기존 계정을 확인하세요.'
    }
    return '이미 사용 중인 login_id입니다.'
  }
  if (code === '23514' || /check constraint/i.test(msg)) {
    return '학년·반·성별 값이 허용 범위를 벗어났습니다.'
  }
  if (code === '23502' || /not[- ]null/i.test(msg)) {
    return '필수 항목이 비어 있습니다.'
  }
  if (code === '22P02' || /invalid input syntax/i.test(msg)) {
    return '입력 형식이 잘못되었습니다.'
  }
  if (code === '23503' || /foreign key/i.test(msg)) {
    return '담당 매니저 정보가 올바르지 않습니다.'
  }
  return msg || '저장 중 오류가 발생했습니다.'
}
