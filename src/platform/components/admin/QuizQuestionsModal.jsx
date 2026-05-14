import { useMemo, useState } from 'react'
import { X, Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react'
import QuizQuestionEditModal from './QuizQuestionEditModal.jsx'

export default function QuizQuestionsModal({
  quizSet,
  questions,
  attemptCount,
  onClose,
  onCreateQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
}) {
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const sorted = useMemo(
    () => [...questions].sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0)),
    [questions]
  )

  const defaultOrderNo = useMemo(() => {
    if (sorted.length === 0) return 1
    return Math.max(...sorted.map((q) => q.orderNo ?? 0)) + 1
  }, [sorted])

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await onDeleteQuestion(confirmDelete.id)
      setConfirmDelete(null)
    } catch (err) {
      console.error('문제 삭제 실패:', err)
      alert(err?.message ?? '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-gray-800">{quizSet.title}</p>
            <p className="text-[11px] text-gray-500">
              {quizSet.grade} · {quizSet.round}회 · 문제 {sorted.length}개
              {attemptCount > 0 && (
                <span className="ml-1 text-amber-600">· 응시 {attemptCount}명</span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2">
          {attemptCount > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                이 회차는 <span className="font-bold">{attemptCount}명</span>이 이미 응시했습니다.
                문제 수정·삭제는 가능하지만 기존 응시 기록의 점수에는 반영되지 않습니다.
              </p>
            </div>
          )}

          {sorted.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">
              아직 등록된 문제가 없습니다. 아래 "새 문제 추가"를 눌러 시작하세요.
            </div>
          ) : (
            sorted.map((q) => (
              <div key={q.id} className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 leading-relaxed">
                      <span className="text-[10px] font-bold text-gray-400 mr-1">Q{q.orderNo}.</span>
                      {q.question}
                    </p>
                    <div className="mt-1 text-[11px] space-y-0.5">
                      <p>
                        <span className="text-gray-400">정답: </span>
                        <span className="text-emerald-700 font-semibold">{q.acceptedAnswers[0]}</span>
                        {q.acceptedAnswers.length > 1 && (
                          <span className="text-gray-400"> · {q.acceptedAnswers.slice(1).join(', ')}</span>
                        )}
                      </p>
                      {q.explanation && (
                        <p className="text-gray-500 truncate">
                          <span className="text-gray-400">해설: </span>{q.explanation}
                        </p>
                      )}
                      {q.hint && (
                        <p className="text-gray-500 truncate">
                          <span className="text-gray-400">힌트: </span>{q.hint}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setEditingQuestion(q)}
                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"
                      title="편집"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(q)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={() => setCreating(true)}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white flex items-center justify-center gap-1"
          >
            <Plus size={16} />
            새 문제 추가
          </button>
        </div>
      </div>

      {creating && (
        <QuizQuestionEditModal
          mode="create"
          quizSetId={quizSet.id}
          defaultOrderNo={defaultOrderNo}
          onSubmit={onCreateQuestion}
          onClose={() => setCreating(false)}
        />
      )}

      {editingQuestion && (
        <QuizQuestionEditModal
          mode="edit"
          initial={editingQuestion}
          quizSetId={quizSet.id}
          onSubmit={(payload) => onUpdateQuestion(editingQuestion.id, payload)}
          onClose={() => setEditingQuestion(null)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-800">문제 삭제</p>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Q{confirmDelete.orderNo} 문제를 삭제하시겠습니까?
                  {attemptCount > 0 && (
                    <span className="block mt-1 text-amber-700">
                      이 회차는 {attemptCount}명이 응시했습니다. 기존 응시 기록의 점수는 그대로 유지됩니다.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-500 text-sm font-semibold text-white disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
