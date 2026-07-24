// 하단 바 '과제' 탭 새 과제 배지 훅 — 마지막으로 과제 탭을 확인한 시각(localStorage,
// 학생별·기기별)을 기준으로, 그 이후 등록된(createdAt) 과제 수를 센다.
// - 과제 탭을 보고 있는 동안은 항상 확인 처리 → 배지 소거 (도중에 와도 소거)
// - 첫 사용(저장값 없음)은 지금 시각으로 초기화: 도입 시점에 기존 과제 전체가
//   '새 과제'로 잡혀 전 학생에게 배지가 쏟아지는 것을 방지
// - createdAt 없는 레거시 행은 세지 않는다
//
// 별도 state 없이 렌더 시 localStorage에서 파생한다 — 배지가 변해야 하는 순간
// (탭 전환 = useLocation 리렌더, 과제 데이터 변경)마다 어차피 리렌더가 일어난다.

import { useEffect } from 'react'

const seenKey = (studentId) => `namac_tasks_seen_at_${studentId ?? 'anon'}`

const readSeenAt = (studentId) => {
  try {
    const raw = localStorage.getItem(seenKey(studentId))
    const ms = raw ? Number(raw) : NaN
    return Number.isFinite(ms) ? ms : null
  } catch {
    return null
  }
}

const writeSeenAt = (studentId, ms) => {
  try {
    localStorage.setItem(seenKey(studentId), String(ms))
  } catch {
    // 저장 실패(시크릿 모드 등)여도 배지만 계속 뜰 뿐 동작에는 지장 없음
  }
}

export default function useTaskBadge(studentId, tasks, isTaskTabActive) {
  // 첫 사용 초기화 (외부 저장소 쓰기만 — setState 없음)
  useEffect(() => {
    if (!studentId) return
    if (readSeenAt(studentId) == null) writeSeenAt(studentId, Date.now())
  }, [studentId])

  // 과제 탭을 보고 있는 동안은 항상 확인 처리 (새 과제가 도중에 와도 갱신)
  useEffect(() => {
    if (!studentId || !isTaskTabActive) return
    writeSeenAt(studentId, Date.now())
  }, [studentId, isTaskTabActive, tasks])

  if (!studentId || isTaskTabActive) return 0
  const seenAt = readSeenAt(studentId)
  if (seenAt == null) return 0 // 첫 사용 — 초기화 effect 실행 전
  return tasks.filter((t) => {
    if (!t.createdAt) return false
    const created = new Date(t.createdAt).getTime()
    return Number.isFinite(created) && created > seenAt
  }).length
}
