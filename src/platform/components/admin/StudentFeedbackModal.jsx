// 학생 피드백 모달 — 학생 명단 '피드백' 버튼에서 열림 (2026-08 클라이언트 요청:
// "과제 내기 옆에 피드백 — 수시로 기록 내용에 대한 코멘트").
// 학생을 골라 수시 코멘트를 작성하고, 그 학생의 기존 피드백을 열람·수정·삭제한다.
// 데이터는 studentFeedbacks 컬렉션(student_feedbacks) — 상세 페이지 '피드백' 탭과 공유.
import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import ModalShell from '../common/ModalShell.jsx'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { todayStr } from '../../utils/dateUtils.js'

export default function StudentFeedbackModal({ students, initialStudentId, onClose }) {
  const { data, addStudentFeedback, updateStudentFeedback, deleteStudentFeedback } = useData()
  const { currentUser } = useAuth()

  const [studentId, setStudentId] = useState(initialStudentId ?? students[0]?.id ?? '')
  const [date, setDate] = useState(todayStr())
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState(null) // 인라인 수정 대상 피드백 id
  const [editDate, setEditDate] = useState('')
  const [editContent, setEditContent] = useState('')

  const feedbacks = data.studentFeedbacks
    .filter((f) => f.studentId === studentId)
    .slice()
    .sort((a, b) => (a.date !== b.date
      ? (b.date > a.date ? 1 : -1)
      : ((b.createdAt ?? '') > (a.createdAt ?? '') ? 1 : -1)))

  // 본인 작성분 or admin만 수정/삭제
  const canManage = (f) => f.authorId === currentUser?.id || currentUser?.role === 'admin'

  const handleAdd = async () => {
    if (!studentId || !content.trim() || busy) return
    setBusy(true)
    try {
      await addStudentFeedback({
        studentId,
        authorId: currentUser?.id ?? null,
        authorName: currentUser?.name ?? '',
        date,
        content: content.trim(),
      })
      setContent('')
      setDate(todayStr())
    } catch {
      alert('피드백 저장 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleEditSave = async () => {
    if (!editContent.trim() || busy) return
    setBusy(true)
    try {
      await updateStudentFeedback(editId, { date: editDate, content: editContent.trim() })
      setEditId(null)
    } catch {
      alert('피드백 수정 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 피드백을 삭제할까요?')) return
    try {
      await deleteStudentFeedback(id)
    } catch {
      alert('피드백 삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <ModalShell title="학생 피드백" onClose={onClose} maxWidth="max-w-md">
      {/* 학생 선택 */}
      <div>
        <label className="block text-[11px] font-bold text-gray-500 mb-1">학생</label>
        <select
          value={studentId}
          onChange={(e) => { setStudentId(e.target.value); setEditId(null) }}
          disabled={!!initialStudentId}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white disabled:bg-gray-50"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.school ? ` — ${s.school}` : ''}{s.grade ? ` ${s.grade}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 작성 폼 */}
      <div className="space-y-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder="기록 내용에 대한 코멘트를 입력하세요"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || !studentId || !content.trim()}
          className="w-full py-2.5 rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-40"
        >
          {busy ? '저장 중…' : '피드백 저장'}
        </button>
      </div>

      {/* 기존 피드백 목록 (최신순) */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-semibold">피드백 기록 ({feedbacks.length}건)</p>
        {feedbacks.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">피드백이 없습니다.</p>
        ) : (
          feedbacks.map((f) => (
            <div key={f.id} className="bg-gray-50 rounded-xl p-3">
              {editId === f.id ? (
                <div className="space-y-2">
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="flex-1 py-1.5 rounded-lg bg-gray-200 text-xs font-semibold text-gray-600"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleEditSave}
                      disabled={busy || !editContent.trim()}
                      className="flex-1 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      수정 저장
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">
                      {f.date}{f.authorName ? ` · ${f.authorName}` : ''}
                    </span>
                    {canManage(f) && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(f.id)
                            setEditDate(f.date)
                            setEditContent(f.content)
                          }}
                          className="text-gray-400 hover:text-blue-600 p-0.5"
                          aria-label="피드백 수정"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(f.id)}
                          className="text-gray-400 hover:text-red-600 p-0.5"
                          aria-label="피드백 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{f.content}</p>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </ModalShell>
  )
}
