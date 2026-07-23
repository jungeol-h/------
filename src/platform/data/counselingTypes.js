// 상담 분류(카테고리) 공용 상수. 작성 폼 셀렉트와 표시(라벨) 양쪽에서 재사용한다.
// 배열 순서가 곧 표시 순서.
//
// 2026-07 클라이언트 확정 체계 (내부/외부 상담 동일):
// 유형 6종 + 내용 6단계(보고서 양식). 구 체계(study/career/habit/mind/etc)로
// 저장된 기존 기록은 라벨만 유지해 표시한다 — COUNSELING_TYPES(셀렉트 옵션)에는 넣지 않는다.

export const COUNSELING_TYPES = [
  'career_path',    // 진로진학
  'assessment',     // 검사
  'subject_learning', // 교과학습
  'self_directed',  // 자기주도학습코칭
  'adjustment',     // 생활적응
  'etc',            // 기타
]

export const COUNSELING_TYPE_LABELS = {
  career_path: '진로진학',
  assessment: '검사',
  subject_learning: '교과학습',
  self_directed: '자기주도학습코칭',
  adjustment: '생활적응',
  etc: '기타',
  // ── 구 체계 (표시 전용) ──
  study: '학습',
  career: '진로',
  habit: '생활습관',
  mind: '심리',
}

// 피상담자 유형 — 외부 상담 기록에서 사용 (program_counseling_records.target_type)
export const COUNSELING_TARGET_TYPES = ['student', 'student_parent', 'mother', 'father']

export const COUNSELING_TARGET_LABELS = {
  student: '학생',
  student_parent: '학생+보호자',
  mother: '학생 모',
  father: '학생 부',
}

// ── 내용 6단계 (보고서 양식, 내부/외부 동일) ──────────────────
// 상담주제/진단/조언/후속조치/특이사항/다음상담예약. 신규 기록은 6필드로 구조화
// 저장하고, content 컬럼에는 합성 텍스트를 함께 저장한다(NOT NULL 유지·PDF/레거시 소비처 호환).

export const COUNSELING_FIELDS = ['topic', 'diagnosis', 'advice', 'followUp', 'note', 'nextAppointment']

export const COUNSELING_FIELD_LABELS = {
  topic: '상담주제',
  diagnosis: '진단',
  advice: '조언',
  followUp: '후속조치',
  note: '특이사항',
  nextAppointment: '다음상담예약',
}

// 6필드 → content 저장용 합성 텍스트. 빈 필드는 생략.
export function composeCounselingContent(fields) {
  return COUNSELING_FIELDS.map((key) => {
    const value = fields[key]?.trim()
    return value ? `[${COUNSELING_FIELD_LABELS[key]}] ${value}` : null
  })
    .filter(Boolean)
    .join('\n')
}

// 기록이 구조화 필드를 갖고 있는지 — 구 기록(단일 content)은 false.
export function hasStructuredContent(record) {
  return COUNSELING_FIELDS.some((key) => record?.[key]?.trim?.())
}
