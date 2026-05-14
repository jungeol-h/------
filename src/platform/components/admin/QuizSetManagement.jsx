import { useMemo, useState } from 'react'
import { Settings, Plus, Edit2, Trash2, Eye, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import QuizSetEditModal from './QuizSetEditModal.jsx'
import QuizQuestionsModal from './QuizQuestionsModal.jsx'

export default function QuizSetManagement() {
  const {
    data,
    createQuizSet,
    updateQuizSet,
    deleteQuizSet,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
  } = useData()

  const [creatingSet, setCreatingSet] = useState(false)
  const [editingSet, setEditingSet] = useState(null)
  const [viewingSetId, setViewingSetId] = useState(null)
  const [confirmDeleteSet, setConfirmDeleteSet] = useState(null)
  const [togglingSetId, setTogglingSetId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const sortedSets = useMemo(
    () => [...data.quizSets].sort((a, b) =>
      (a.grade ?? '').localeCompare(b.grade ?? '') || (a.round ?? 0) - (b.round ?? 0)
    ),
    [data.quizSets]
  )

  const questionsBySet = useMemo(() => {
    const map = {}
    data.quizQuestions.forEach((q) => {
      if (!map[q.quizSetId]) map[q.quizSetId] = []
      map[q.quizSetId].push(q)
    })
    return map
  }, [data.quizQuestions])

  const attemptsBySet = useMemo(() => {
    const map = {}
    data.quizAttempts.forEach((a) => {
      if (!map[a.quizSetId]) map[a.quizSetId] = 0
      map[a.quizSetId] += 1
    })
    return map
  }, [data.quizAttempts])

  const viewingSet = viewingSetId ? sortedSets.find((s) => s.id === viewingSetId) : null
  const viewingQuestions = viewingSetId ? (questionsBySet[viewingSetId] ?? []) : []
  const viewingAttemptCount = viewingSetId ? (attemptsBySet[viewingSetId] ?? 0) : 0

  const handleTogglePublish = async (set) => {
    setTogglingSetId(set.id)
    try {
      await updateQuizSet(set.id, { isPublished: !set.isPublished })
    } catch (err) {
      console.error('배포 토글 실패:', err)
      alert(err?.message ?? '배포 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setTogglingSetId(null)
    }
  }

  const handleDeleteSetConfirm = async () => {
    if (!confirmDeleteSet) return
    setDeleting(true)
    try {
      await deleteQuizSet(confirmDeleteSet.id)
      setConfirmDeleteSet(null)
    } catch (err) {
      console.error('회차 삭제 실패:', err)
      alert(err?.message ?? '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-800">회차/문제 관리</h2>
        </div>
        <button
          onClick={() => setCreatingSet(true)}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white flex items-center gap-1"
        >
          <Plus size={14} />
          새 회차
        </button>
      </div>

      {sortedSets.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">
          아직 등록된 회차가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedSets.map((set) => {
            const questionCount = (questionsBySet[set.id] ?? []).length
            const attemptCount = attemptsBySet[set.id] ?? 0
            return (
              <div key={set.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-emerald-600">{set.grade} · {set.round}회</span>
                      {!set.isPublished && (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">미배포</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-snug mt-0.5 truncate">{set.title}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      문제 {questionCount}개 · 응시 {attemptCount}명
                      {set.source && <span className="ml-1">· {set.source}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => handleTogglePublish(set)}
                      disabled={togglingSetId === set.id}
                      className="p-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      title={set.isPublished ? '배포 중 (클릭하여 OFF)' : '미배포 (클릭하여 ON)'}
                    >
                      {set.isPublished
                        ? <ToggleRight size={20} className="text-emerald-600" />
                        : <ToggleLeft  size={20} className="text-gray-400" />
                      }
                    </button>
                    <button
                      onClick={() => setViewingSetId(set.id)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                      title="문제 보기"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => setEditingSet(set)}
                      className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"
                      title="편집"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteSet(set)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {creatingSet && (
        <QuizSetEditModal
          mode="create"
          onSubmit={createQuizSet}
          onClose={() => setCreatingSet(false)}
        />
      )}

      {editingSet && (
        <QuizSetEditModal
          mode="edit"
          initial={editingSet}
          onSubmit={(payload) => updateQuizSet(editingSet.id, payload)}
          onClose={() => setEditingSet(null)}
        />
      )}

      {viewingSet && (
        <QuizQuestionsModal
          quizSet={viewingSet}
          questions={viewingQuestions}
          attemptCount={viewingAttemptCount}
          onClose={() => setViewingSetId(null)}
          onCreateQuestion={createQuizQuestion}
          onUpdateQuestion={updateQuizQuestion}
          onDeleteQuestion={deleteQuizQuestion}
        />
      )}

      {confirmDeleteSet && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-800">회차 삭제</p>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  <span className="font-semibold">{confirmDeleteSet.title}</span> 회차를 삭제하시겠습니까?
                  <span className="block mt-1">
                    소속 문제 {(questionsBySet[confirmDeleteSet.id] ?? []).length}개도 함께 삭제됩니다.
                  </span>
                  {(attemptsBySet[confirmDeleteSet.id] ?? 0) > 0 && (
                    <span className="block mt-1 text-red-700">
                      ⚠ 응시 기록 {attemptsBySet[confirmDeleteSet.id]}건도 함께 삭제됩니다 (복구 불가).
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteSet(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700"
              >
                취소
              </button>
              <button
                onClick={handleDeleteSetConfirm}
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
