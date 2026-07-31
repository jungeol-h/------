// 업무기록 통합 탭 공용 상수 — 메뉴·업무계획 진행상황·관리보고 유형·재정 분류.
// counselingTypes.js와 같은 방식: 배열 순서가 곧 표시 순서.

// ── 업무기록 탭 메뉴 6종 ─────────────────────────────────────
// plans/management/finance는 admin 전용 작성(viewer 열람), counseling/lesson/notices는 공통.
export const WORK_RECORD_MENUS = [
  { key: 'plans', label: '업무계획' },
  { key: 'management', label: '관리보고' },
  { key: 'finance', label: '재정' },
  { key: 'counseling', label: '상담보고' },
  { key: 'lesson', label: '수업보고' },
  { key: 'notices', label: '공지·알림' },
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

// ── 업무계획 업무내용 9종 (2026-07-30 개편 — 이전 값은 COUNSELING_TYPES 재사용이었다.
// 구 기록 표시는 WorkPlanTab에서 COUNSELING_TYPE_LABELS 폴백으로 처리) ──
export const WORK_PLAN_TYPES = [
  'career_consulting',
  'assessment_consulting',
  'subject_consulting',
  'self_directed_coaching',
  'event_mgmt',
  'meeting',
  'inquiry',
  'program_mgmt',
  'etc',
]

export const WORK_PLAN_TYPE_LABELS = {
  career_consulting: '진로진학 컨설팅',
  assessment_consulting: '검사컨설팅',
  subject_consulting: '교과 컨설팅',
  self_directed_coaching: '자기주도학습 코칭',
  event_mgmt: '행사관리',
  meeting: '회의',
  inquiry: '문의 처리',
  program_mgmt: '프로그램관리',
  etc: '기타',
}

// ── 업무계획 대상 5종 (복수선택) ─────────────────────────────
export const WORK_PLAN_AUDIENCES = ['student', 'parent', 'instructor', 'city_officer', 'admin']

export const WORK_PLAN_AUDIENCE_LABELS = {
  student: '학생',
  parent: '학부모',
  instructor: '강사',
  city_officer: '시청담당자',
  admin: '관리자',
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
