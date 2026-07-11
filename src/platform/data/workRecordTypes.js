// 업무기록 통합 탭 공용 상수 — 메뉴·업무계획 진행상황·관리보고 유형·재정 분류.
// counselingTypes.js와 같은 방식: 배열 순서가 곧 표시 순서.

// ── 업무기록 탭 메뉴 5종 ─────────────────────────────────────
// plans/management/finance는 admin 전용 작성(viewer 열람), counseling/lesson은 공통.
export const WORK_RECORD_MENUS = [
  { key: 'plans', label: '업무계획' },
  { key: 'management', label: '관리보고' },
  { key: 'finance', label: '재정' },
  { key: 'counseling', label: '상담보고' },
  { key: 'lesson', label: '수업보고' },
]

export const ADMIN_ONLY_MENUS = ['plans', 'management', 'finance']

// ── 업무계획 진행상황 ────────────────────────────────────────
export const WORK_PLAN_STATUSES = ['planned', 'in_progress', 'done']

export const WORK_PLAN_STATUS_LABELS = {
  planned: '예정',
  in_progress: '진행중',
  done: '완료',
}

export const WORK_PLAN_STATUS_BADGE = {
  planned: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-50 text-blue-600',
  done: 'bg-emerald-50 text-emerald-600',
}

// ── 관리보고 업무유형 6종 ────────────────────────────────────
export const MANAGEMENT_WORK_TYPES = [
  'instructor_mgmt',    // 강사관리
  'operation_schedule', // 운영일정관리
  'inquiry',            // 문의처리
  'event',              // 행사진행
  'meeting',            // 회의
  'etc',                // 기타
]

export const MANAGEMENT_WORK_TYPE_LABELS = {
  instructor_mgmt: '강사관리',
  operation_schedule: '운영일정관리',
  inquiry: '문의처리',
  event: '행사진행',
  meeting: '회의',
  etc: '기타',
}

// ── 재정 구입품목·결제수단 ───────────────────────────────────
export const FINANCE_CATEGORIES = ['snack', 'supplies', 'textbook', 'teaching_aid', 'etc']

export const FINANCE_CATEGORY_LABELS = {
  snack: '간식',
  supplies: '비품',
  textbook: '교재',
  teaching_aid: '교구',
  etc: '기타',
}

export const PAYMENT_METHODS = ['personal_card', 'cash']

export const PAYMENT_METHOD_LABELS = {
  personal_card: '개인카드',
  cash: '현금',
}

// ── 수업보고 ─────────────────────────────────────────────────
export const LESSON_MAX_STUDENTS = 10
