import { useMemo, useState } from 'react'
import { X, CheckCircle2, Siren } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { educatorDisplayName } from '../../utils/educatorName.js'

// 관리자용 긴급 보고 목록 모달 — 미확인 우선 표시, [확인] 처리.
// readOnly: 감독관(viewer) 열람용 — 확인 처리 버튼 숨김.
export default function UrgentReportListModal({ onClose, readOnly = false }) {
  const { data, confirmUrgentReport } = useData()
  const { currentUser } = useAuth()
  const [confirmingId, setConfirmingId] = useState(null)

  const reports = useMemo(
    () => data.urgentReports
      .slice()
      .sort((a, b) => {
        if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1 // 미확인 우선
        return String(b.createdAt).localeCompare(String(a.createdAt))
      }),
    [data.urgentReports]
  )

  const handleConfirm = async (id) => {
    if (confirmingId) return
    setConfirmingId(id)
    try {
      await confirmUrgentReport(id, currentUser?.id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setConfirmingId(null)
    }
  }

  const authorLabel = (authorId) => {
    const author = data.educators.find((e) => e.id === authorId)
    return author ? educatorDisplayName(author) : '알 수 없음'
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Siren size={17} className="text-red-500" />
            <h3 className="font-bold text-gray-900 text-base">긴급 보고 · 건의</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        {reports.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">접수된 긴급 보고가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => (
              <li
                key={r.id}
                className={`rounded-xl p-3 border ${r.confirmed ? 'bg-gray-50 border-gray-100' : 'bg-red-50/60 border-red-100'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-gray-700">{authorLabel(r.authorId)}</p>
                  <span className="text-[11px] text-gray-400">
                    {String(r.createdAt).slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-800 mt-1.5 whitespace-pre-wrap break-words">{r.content}</p>
                <div className="mt-2 flex justify-end">
                  {r.confirmed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 size={12} /> 확인됨
                    </span>
                  ) : readOnly ? (
                    <span className="text-[11px] font-bold text-red-400">미확인</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleConfirm(r.id)}
                      disabled={confirmingId === r.id}
                      className="text-xs font-bold bg-red-500 text-white rounded-lg px-3 py-1.5 hover:bg-red-600 active:scale-95 transition disabled:opacity-40"
                    >
                      확인 처리
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
