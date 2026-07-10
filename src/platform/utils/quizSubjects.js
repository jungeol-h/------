// 확인평가 과목 상수 — 출제/모니터링/학생 응시 화면이 공유한다.
// users.subject(강사 담당 과목)와 값이 일치해야 강사 스코핑이 동작한다.

export const QUIZ_SUBJECTS = ['국어', '영어', '수학', '과학']

export const DEFAULT_QUIZ_SUBJECT = '국어'

// Tailwind 배지 색상 — 학년 배지(GRADE_BADGE)와 같은 패턴
export const SUBJECT_BADGE = {
  '국어': 'bg-orange-50 text-orange-700 border-orange-200',
  '영어': 'bg-blue-50 text-blue-700 border-blue-200',
  '수학': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '과학': 'bg-purple-50 text-purple-700 border-purple-200',
}

// 강사 본인의 출제 과목 — 4과목에 해당할 때만 스코핑에 사용
export function instructorQuizSubject(user) {
  if (!user || user.role !== 'instructor') return null
  return QUIZ_SUBJECTS.includes(user.subject) ? user.subject : null
}
