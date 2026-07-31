// 공지 팝업 — 로그인 후 홈 진입 시 미확인 공지(kind='announcement')를 1회 노출.
// 노출 기록은 서버가 아니라 localStorage(`namac_notice_{noticeId}_{userId}`)에 남긴다
// — tempBetaNotice.js/TimerFixNoticeModal과 같은 방식. 스토리지 예외는 무시(try/catch).

import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import ModalShell from './ModalShell.jsx'

const storageKey = (noticeId, userId) => `namac_notice_${noticeId}_${userId}`

function seen(noticeId, userId) {
  try {
    return !!localStorage.getItem(storageKey(noticeId, userId))
  } catch {
    return false
  }
}

function markSeen(noticeId, userId) {
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
  const [dismissed, setDismissed] = useState(false)

  if (!currentUser?.id || dismissed) return null

  const unseen = data.notices.filter(
    (n) => n.kind === 'announcement' && n.active && !seen(n.id, currentUser.id)
  )

  if (unseen.length === 0) return null

  const handleConfirm = () => {
    unseen.forEach((n) => markSeen(n.id, currentUser.id))
    setDismissed(true)
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
