// 확인평가 채점 유틸 — 공백 제거 + 대소문자 무시 + 복수정답 허용

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
    return { questionId: q.id, raw, isCorrect: isCorrect(raw, q.acceptedAnswers) }
  })
  const score = answers.filter((a) => a.isCorrect).length
  return { answers, score, total: questions.length }
}
