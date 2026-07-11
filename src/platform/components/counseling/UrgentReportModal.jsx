import { useMemo, useState } from 'react'
import { Send, CheckCircle2, Clock } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import ModalShell from '../common/ModalShell.jsx'

// 긴급 보고·건의 모달 — 강사/컨설턴트/매니저가 관리자에게 직접 전달.
// 하단에 본인이 보낸 최근 보고 목록 + 관리자 확인 여부 배지.
export default function UrgentReportModal({ onClose }) {
  const { data, addUrgentReport } = useData()
  const { currentUser } = useAuth()
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const myReports = useMemo(
    () => data.urgentReports
      .filter((r) => r.authorId === currentUser?.id)
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 10),
    [data.urgentReports, currentUser?.id]
  )

  const canSend = !saving && content.trim()

  const handleSend = async () => {
    if (!canSend) return
    setSaving(true)
    try {
      await addUrgentReport({ authorId: currentUser?.id, content: content.trim() })
      setContent('')
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title="긴급 보고 · 건의" onClose={onClose} maxHeight="max-h-[85vh]">
        <p className="text-xs text-gray-500 -mt-2">
          관리자에게 바로 전달됩니다. 관리자가 확인하면 목록에 표시돼요.
        </p>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="긴급하게 전달할 내용이나 건의사항을 입력하세요"
          rows={4}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="w-full py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={15} />
          관리자에게 보내기
        </button>

        {myReports.length > 0 && (
          <div className="pt-1">
            <p className="text-xs font-bold text-gray-500 mb-2">내가 보낸 보고</p>
            <ul className="space-y-2">
              {myReports.map((r) => (
                <li key={r.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-400">
                      {String(r.createdAt).slice(0, 16).replace('T', ' ')}
                    </span>
                    {r.confirmed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 size={11} /> 확인됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                        <Clock size={11} /> 확인 대기
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{r.content}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
    </ModalShell>
  )
}
