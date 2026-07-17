// 인앱 알림 벨 — 미확인 배지 + 목록 시트. Realtime 수신은 BookingContext가 담당.
import { useState } from 'react'
import { Bell, Check } from 'lucide-react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { useBooking } from '../BookingContext.jsx'

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function BookingNotificationsBell() {
  const { notifications, resolveNotification, resolveAllNotifications } = useBooking()
  const [open, setOpen] = useState(false)
  const unread = notifications.filter((n) => !n.resolved).length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-lg bg-gray-100 text-gray-600"
        aria-label="예약 알림"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <ModalShell title="예약 알림" onClose={() => setOpen(false)}>
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">알림이 없습니다.</p>
          ) : (
            <>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={resolveAllNotifications}
                  className="text-xs font-bold text-blue-600"
                >
                  모두 읽음 처리
                </button>
              )}
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl p-3 text-sm flex items-start gap-2 ${
                      n.resolved ? 'bg-gray-50 text-gray-400' : 'bg-blue-50 text-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="whitespace-pre-wrap break-words">{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{formatDateTime(n.createdAt)}</p>
                    </div>
                    {!n.resolved && (
                      <button
                        type="button"
                        onClick={() => resolveNotification(n.id)}
                        className="p-1 text-blue-500"
                        aria-label="읽음 처리"
                      >
                        <Check size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </ModalShell>
      )}
    </>
  )
}
