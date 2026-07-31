// 알림 칸 — 학생/학부모 홈에서 kind='notification' 공지를 날짜+내용 누적 리스트로 표시.
// AttendanceTab.jsx '긴급 확인 필요' 카드 리스트와 같은 미리보기 4건+더보기 토글 구조지만
// 색상은 중립(블루/그레이)으로 쓴다.

import { useMemo, useState } from 'react'
import { Bell, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'

const PREVIEW = 4

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} · ${hh}:${mm}`
}

export default function NoticeFeedCard({ audience }) {
  const { data } = useData()
  const [expanded, setExpanded] = useState(false)

  const notices = useMemo(
    () => data.notices
      .filter((n) => n.kind === 'notification' && n.active && (n.audience === 'all' || n.audience === audience))
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [data.notices, audience]
  )

  if (notices.length === 0) return null

  const visible = expanded ? notices : notices.slice(0, PREVIEW)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={16} className="text-blue-500" />
        <h3 className="text-sm font-bold text-gray-700">알림</h3>
        <span className="bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
          {notices.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {visible.map((n) => (
          <div key={n.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{n.content}</p>
            <p className="text-[11px] text-gray-400 mt-1">{fmtDateTime(n.createdAt)}</p>
          </div>
        ))}
      </div>
      {notices.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full py-2 mt-1 text-xs font-bold text-gray-400 flex items-center justify-center gap-1"
        >
          {expanded
            ? <>접기 <ChevronUp size={13} /></>
            : <>외 {notices.length - PREVIEW}건 더 보기 <ChevronDown size={13} /></>}
        </button>
      )}
    </div>
  )
}
