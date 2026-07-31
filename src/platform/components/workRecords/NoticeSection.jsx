// 공지·알림 메뉴 — 업무기록 탭 공용(admin·강사 등 전 역할). 구분(공지 팝업/알림)·
// 대상(전체/학생/학부모)을 지정해 작성한다. 공지는 대상이 전체로 고정된다(폼에서 강제).
// 목록은 최신순으로 구분·대상·작성일·작성자·내용 + 내리기/다시 올리기(active 토글)·삭제.

import { useState } from 'react'
import { CheckCheck, EyeOff, Eye, Trash2 } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

const KIND_OPTIONS = [
  { value: 'notification', label: '알림 (홈 알림 칸)' },
  { value: 'announcement', label: '공지 (로그인 팝업)' },
]

const AUDIENCE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'student', label: '학생' },
  { value: 'parent', label: '학부모' },
]

const KIND_LABELS = { announcement: '공지', notification: '알림' }
const AUDIENCE_LABELS = { all: '전체', student: '학생', parent: '학부모' }

const EMPTY_FORM = () => ({
  kind: 'notification',
  audience: 'all',
  title: '',
  content: '',
})

const fieldClass =
  'border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300'

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function NoticeSection({ readOnly = false }) {
  const { data, addNotice, updateNotice, deleteNotice } = useData()
  const { currentUser } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const isAnnouncement = form.kind === 'announcement'
  const canSave = !saving && form.content.trim() && (!isAnnouncement || form.title.trim())

  const setKind = (e) => {
    const kind = e.target.value
    setForm((prev) => ({ ...prev, kind, audience: kind === 'announcement' ? 'all' : prev.audience }))
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await addNotice({
        kind: form.kind,
        audience: isAnnouncement ? 'all' : form.audience,
        title: form.title.trim(),
        content: form.content.trim(),
        createdBy: currentUser?.id,
        createdByName: currentUser?.name ?? '',
        active: true,
      })
      setForm(EMPTY_FORM())
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (n) => {
    setBusyId(n.id)
    try {
      await updateNotice(n.id, { active: !n.active })
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (n) => {
    if (!window.confirm('이 항목을 삭제할까요?')) return
    setBusyId(n.id)
    try {
      await deleteNotice(n.id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setBusyId(null)
    }
  }

  const list = data.notices
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  return (
    <div className="space-y-6">
      {!readOnly && (
        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-gray-900">새 공지·알림</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">구분</label>
              <select value={form.kind} onChange={setKind} className={`${fieldClass} w-full`}>
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">대상</label>
              <select
                value={isAnnouncement ? 'all' : form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                disabled={isAnnouncement}
                className={`${fieldClass} w-full disabled:bg-gray-50 disabled:text-gray-400`}
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          {isAnnouncement && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">제목</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`${fieldClass} w-full`}
                placeholder="공지 제목"
              />
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">내용</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              className={`${fieldClass} w-full resize-none`}
              placeholder="내용을 입력하세요"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="py-2.5 px-6 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCheck size={16} />
              저장
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">공지·알림 목록</h2>
        {list.length === 0 ? (
          <div className="text-center text-gray-400 py-12">등록된 공지·알림이 없어요 📢</div>
        ) : (
          <div className="space-y-3">
            {list.map((n) => (
              <div key={n.id} className={`bg-white rounded-2xl p-4 shadow-sm ${!n.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      n.kind === 'announcement' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {KIND_LABELS[n.kind] ?? n.kind}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                      {AUDIENCE_LABELS[n.audience] ?? n.audience}
                    </span>
                    {!n.active && (
                      <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-semibold">
                        내림
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {fmtDateTime(n.createdAt)} · {n.createdByName || '작성자 미상'}
                    </span>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(n)}
                        disabled={busyId === n.id}
                        className="text-gray-400 hover:text-blue-600 p-0.5 disabled:opacity-40"
                        aria-label={n.active ? '내리기' : '다시 올리기'}
                        title={n.active ? '내리기' : '다시 올리기'}
                      >
                        {n.active ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => handleDelete(n)}
                        disabled={busyId === n.id}
                        className="text-gray-400 hover:text-red-600 p-0.5 disabled:opacity-40"
                        aria-label="삭제"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {n.title && <p className="text-sm font-bold text-gray-900">{n.title}</p>}
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{n.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
