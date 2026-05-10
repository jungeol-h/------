import { useState } from 'react'
import { MessageSquarePlus, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const TYPES = [
  { value: 'bug', label: '버그' },
  { value: 'improvement', label: '개선 제안' },
  { value: 'praise', label: '칭찬' },
  { value: 'other', label: '기타' },
]

export default function FeedbackButton() {
  const { currentUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('bug')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const handleOpen = () => {
    setType('bug')
    setContent('')
    setError(null)
    setDone(false)
    setOpen(true)
  }

  const handleClose = () => setOpen(false)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { error: dbError } = await supabase.from('feedback').insert({
        user_id: currentUser?.id ?? null,
        user_name: currentUser?.name ?? null,
        user_role: currentUser?.role ?? null,
        type,
        content: content.trim(),
        page_url: window.location.pathname,
      })
      if (dbError) throw dbError
      setDone(true)
      setTimeout(() => setOpen(false), 1500)
    } catch {
      setError('제출 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5 flex-shrink-0"
        title="피드백 보내기"
      >
        <MessageSquarePlus size={13} />
        <span>피드백</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-base">피드백 보내기</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {done ? (
              <p className="text-center text-emerald-600 font-semibold py-6">감사합니다! 😊</p>
            ) : (
              <>
                <div className="flex gap-2 flex-wrap">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        type === t.value
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="어떤 점이 불편하셨나요?"
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                />

                {error && <p className="text-xs text-red-500">{error}</p>}

                <button
                  onClick={handleSubmit}
                  disabled={!content.trim() || loading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '제출 중...' : '제출하기'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
