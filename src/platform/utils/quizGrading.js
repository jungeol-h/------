// 확인평가 채점 유틸 — 공백 제거 + 대소문자 무시 + 복수정답 허용
// 서술형(type='essay')은 자동채점 불가 → isCorrect/earned: null(채점 대기)로 저장하고
// 교사가 결과 화면에서 0~배점(points) 사이 점수를 입력해 채점한다.
// answers에 문항 배점(points)을 스냅샷으로 저장 — score = Σ득점, total = Σ배점.
// 기존 데이터(answers에 points/earned 없음)는 전부 1점·isCorrect 기반으로 해석한다
// (answerPoints/answerEarned fallback이 보장 — 구 응시도 열람·재채점 가능).

export function normalizeAnswer(s) {
  return String(s ?? '').replace(/\s+/g, '').toLowerCase()
}

export function isCorrect(raw, acceptedAnswers = []) {
  const n = normalizeAnswer(raw)
  if (!n) return false
  return acceptedAnswers.some((a) => normalizeAnswer(a) === n)
}

// 답안의 배점 — points 스냅샷이 없는 구 데이터는 1점
export function answerPoints(a) {
  return Number.isFinite(a?.points) ? a.points : 1
}

// 답안의 득점 — earned 스냅샷이 없는 구 데이터는 isCorrect로 환산. null = 채점 대기
export function answerEarned(a) {
  if (a?.earned !== undefined) return a.earned
  return a?.isCorrect === true ? answerPoints(a) : a?.isCorrect === false ? 0 : null
}

// 채점 대기(서술형 미채점) 답안인지
export function isPendingAnswer(a) {
  return answerEarned(a) === null
}

export function gradeAttempt(questions, rawByQid) {
  const answers = questions.map((q) => {
    const raw = rawByQid[q.id] ?? ''
    const points = Number.isFinite(q.points) ? q.points : 1
    if (q.type === 'essay') {
      return { questionId: q.id, raw, points, isCorrect: null, earned: null }
    }
    const ok = isCorrect(raw, q.acceptedAnswers)
    return { questionId: q.id, raw, points, isCorrect: ok, earned: ok ? points : 0 }
  })
  const score = answers.reduce((sum, a) => sum + (a.earned ?? 0), 0)
  const total = answers.reduce((sum, a) => sum + a.points, 0)
  return { answers, score, total }
}

// 채점 대기 문항(서술형 미채점)이 남아 있는 응시인지
export function hasPendingGrading(attempt) {
  return (attempt?.answers ?? []).some(isPendingAnswer)
}
