// 확인평가 회차 복제용 순서 셔플 — 문제 본문/정답/해설/힌트는 그대로 두고 orderNo만 1..N 순열로 재배치.

export function shuffleQuestionsOrder(questions, rng = Math.random) {
  const arr = [...questions]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.map((q, idx) => ({ ...q, orderNo: idx + 1 }))
}
