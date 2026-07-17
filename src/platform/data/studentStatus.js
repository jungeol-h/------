// 학생 등록 상태 — users.status 값과 표시 라벨.
// 'active' 외의 값은 전 화면에서 숨겨진다: 로그인(AuthContext)·매니저 fetch는
// status='active'만 조회하고, selector들은 (status ?? 'active') === 'active'로 거른다.
// 'inactive'는 상태 세분화(2026-07) 이전의 구 값 — 신규 부여는 없고 기존 행 표시용.
export const STUDENT_STATUS_OPTIONS = [
  { value: 'active', label: '재원' },
  { value: 'cancelled', label: '신청취소' },
  { value: 'withdrawn', label: '퇴원' },
]

export const STUDENT_STATUS_LABELS = {
  active: '재원',
  cancelled: '신청취소',
  withdrawn: '퇴원',
  inactive: '비활성',
}

export const isActiveStudent = (s) => (s?.status ?? 'active') === 'active'
