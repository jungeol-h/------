// 학습 계획/기록 과목 공용 상수 — LearningTab(계획 입력)과
// ClockTimetable(홈 부채꼴 타임테이블)이 같은 색을 쓰도록 한 곳에 둔다.
// 배열 순서가 곧 표시 순서, SUBJECT_COLORS는 인덱스로 대응.

export const SUBJECTS = [
  '국어', '영어', '수학', '과학', '사회', '도덕',
  '역사(한국사)', '기술가정', '한문', '정보',
  '교양 독서', '진로 독서', '진로 탐구',
]

export const SUBJECT_COLORS = [
  '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed',
  '#0891b2', '#65a30d', '#ea580c', '#db2777', '#0d9488',
  '#4f46e5', '#9333ea', '#57534e',
]

// 과목 → 색 (목록에 없는 과목은 회색)
export function subjectColor(subject) {
  const idx = SUBJECTS.indexOf(subject)
  return idx >= 0 ? SUBJECT_COLORS[idx] : '#9ca3af'
}
