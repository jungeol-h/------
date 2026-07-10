// 상담 분류(카테고리) 공용 상수. 작성 폼 셀렉트와 표시(라벨) 양쪽에서 재사용한다.
// 배열 순서가 곧 표시 순서. 기존 저장값(mind/career/study/etc)은 유지하고 라벨만 교체.

export const COUNSELING_TYPES = ['study', 'career', 'habit', 'mind', 'etc']

export const COUNSELING_TYPE_LABELS = {
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
