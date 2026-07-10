// 확인평가 채점 유틸 — 공백 제거 + 대소문자 무시 + 복수정답 허용
// 서술형(type='essay')은 자동채점 불가 → isCorrect: null(채점 대기)로 저장하고
// 교사가 결과 화면에서 수동 채점한다. score는 isCorrect === true 문항 수만 센다.

export function normalizeAnswer(s) {
  return String(s ?? '').replace(/\s+/g, '').toLowerCase()
}

export function isCorrect(raw, acceptedAnswers = []) {
  const n = normalizeAnswer(raw)
  if (!n) return false
  return acceptedAnswers.some((a) => normalizeAnswer(a) === n)
}

export function gradeAttempt(questions, rawByQid) {
  const answers = questions.map((q) => {
    const raw = rawByQid[q.id] ?? ''
    return {
      questionId: q.id,
      raw,
      isCorrect: q.type === 'essay' ? null : isCorrect(raw, q.acceptedAnswers),
    }
  })
  const score = answers.filter((a) => a.isCorrect === true).length
  return { answers, score, total: questions.length }
}

// 채점 대기 문항(서술형 미채점)이 남아 있는 응시인지
export function hasPendingGrading(attempt) {
  return (attempt?.answers ?? []).some((a) => a.isCorrect === null)
}
