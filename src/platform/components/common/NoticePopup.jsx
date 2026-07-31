// 공지 팝업 — 로그인 후 홈 진입 시 미확인 공지(kind='announcement')를 1회 노출.
// 읽음 기록은 서버 notice_reads(사용자 단위 — 다기기에서도 한 번만)가 정본이고,
// localStorage(`namac_notice_{noticeId}_{userId}`)는 오프라인·쓰기 실패 대비 보조.
// notice_reads 조회·쓰기 실패(마이그레이션 미적용 포함) 시 localStorage 판정으로
// 자연 강등된다. 읽음 상태는 이 팝업만 쓰는 데이터라 DataContext에 넣지 않고
// 자체 경량 조회한다 (booking/external 격리 선례).

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import ModalShell from './ModalShell.jsx'

const storageKey = (noticeId, userId) => `namac_notice_${noticeId}_${userId}`

function seenLocal(noticeId, userId) {
  try {
    return !!localStorage.getItem(storageKey(noticeId, userId))
  } catch {
    return false
  }
}

function markSeenLocal(noticeId, userId) {
  try {
    localStorage.setItem(storageKey(noticeId, userId), '1')
  } catch {
    // 무시 — 스토리지 예외로 로그인 흐름을 막지 않는다.
  }
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function NoticePopup() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const [readIds, setReadIds] = useState(null) // null = 서버 읽음 기록 조회 전
  const [dismissed, setDismissed] = useState(false)

  const userId = currentUser?.id

  useEffect(() => {
    if (!userId) return undefined
    let alive = true
    const load = async () => {
      try {
        const { data: rows, error } = await supabase
          .from('notice_reads').select('notice_id').eq('user_id', userId)
        if (error) throw error
        if (alive) setReadIds(new Set((rows ?? []).map((r) => r.notice_id)))
      } catch {
        // 테이블 미적용·일시 오류 — localStorage 판정만으로 진행
        if (alive) setReadIds(new Set())
      }
    }
    load()
    return () => { alive = false }
  }, [userId])

  // 서버 읽음 기록을 확인하기 전에는 띄우지 않는다 (이미 읽은 공지 깜빡임 방지)
  if (!userId || dismissed || readIds === null) return null

  const unseen = data.notices.filter(
    (n) => n.kind === 'announcement' && n.active
      && !readIds.has(n.id) && !seenLocal(n.id, userId)
  )

  if (unseen.length === 0) return null

  const handleConfirm = () => {
    unseen.forEach((n) => markSeenLocal(n.id, userId))
    setDismissed(true)
    // 서버 기록은 베스트 에포트 — 실패해도 localStorage가 이 기기 재노출을 막는다
    supabase
      .from('notice_reads')
      .upsert(
        unseen.map((n) => ({ notice_id: n.id, user_id: userId })),
        { onConflict: 'notice_id,user_id', ignoreDuplicates: true },
      )
      .then(({ error }) => {
        if (!error) setReadIds((prev) => new Set([...prev, ...unseen.map((n) => n.id)]))
      })
  }

  return (
    <ModalShell title="공지" onClose={handleConfirm}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {unseen.map((n) => (
          <div key={n.id} className="border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
            <p className="font-bold text-gray-900 text-sm">{n.title}</p>
            <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap">{n.content}</p>
            <p className="text-[11px] text-gray-400 mt-1.5">{fmtDate(n.createdAt)}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-bold active:scale-95"
      >
        확인
      </button>
    </ModalShell>
  )
}
