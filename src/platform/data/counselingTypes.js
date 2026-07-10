// 상담 분류(카테고리) 공용 상수. 작성 폼 셀렉트와 표시(라벨) 양쪽에서 재사용한다.
// 배열 순서가 곧 표시 순서.
//
// 2026-07 클라이언트 요청으로 유형 체계 교체: 기록하는 강사의 5분야
// (관리자/컨설턴트/교과 코칭/멘토링/비교과강사)가 곧 상담 유형이다.
// 구 체계(study/career/habit/mind/etc)로 저장된 기존 기록은 라벨만 유지해 표시한다
// — COUNSELING_TYPES(셀렉트 옵션)에는 넣지 않는다.

export const COUNSELING_TYPES = ['admin', 'consultant', 'subject_coaching', 'mentoring', 'extracurricular']

export const COUNSELING_TYPE_LABELS = {
  admin: '관리자',
  consultant: '컨설턴트',
  subject_coaching: '교과 코칭',
  mentoring: '멘토링',
  extracurricular: '비교과강사',
  // ── 구 체계 (표시 전용) ──
  study: '학습',
  career: '진로',
  habit: '생활습관',
  mind: '심리',
  etc: '기타',
}

// 피상담자 유형 — 외부 상담 기록에서 사용 (program_counseling_records.target_type)
export const COUNSELING_TARGET_TYPES = ['student', 'mother', 'father']

export const COUNSELING_TARGET_LABELS = {
  student: '학생',
  mother: '학생 모',
  father: '학생 부',
}

// ── 내용 4단계 (보고서 양식) ──────────────────────────────────
// 주제/세부내용/후속조치/특이사항. 신규 기록은 4필드로 구조화 저장하고,
// content 컬럼에는 합성 텍스트를 함께 저장한다(NOT NULL 유지·PDF/레거시 소비처 호환).

export const COUNSELING_FIELDS = ['topic', 'detail', 'followUp', 'note']

export const COUNSELING_FIELD_LABELS = {
  topic: '주제',
  detail: '세부내용',
  followUp: '후속조치',
  note: '특이사항',
}

// 4필드 → content 저장용 합성 텍스트. 빈 필드는 생략.
export function composeCounselingContent({ topic, detail, followUp, note }) {
  return COUNSELING_FIELDS.map((key) => {
    const value = { topic, detail, followUp, note }[key]?.trim()
    return value ? `[${COUNSELING_FIELD_LABELS[key]}] ${value}` : null
  })
    .filter(Boolean)
    .join('\n')
}

// 기록이 4필드 구조를 갖고 있는지 — 구 기록(단일 content)은 false.
export function hasStructuredContent(record) {
  return COUNSELING_FIELDS.some((key) => record?.[key]?.trim?.())
}
