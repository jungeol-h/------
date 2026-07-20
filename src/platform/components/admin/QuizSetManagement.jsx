import { useMemo, useState } from 'react'
import {
  Settings, Plus, Edit2, Trash2, Eye,
  ToggleLeft, ToggleRight, AlertTriangle, Shuffle, ClipboardEdit,
} from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  QUIZ_SUBJECTS, DEFAULT_QUIZ_SUBJECT, SUBJECT_BADGE, instructorQuizSubject,
} from '../../utils/quizSubjects.js'
import QuizSetEditModal from './QuizSetEditModal.jsx'
import QuizQuestionsModal from './QuizQuestionsModal.jsx'
import QuizScoreEntryModal from './QuizScoreEntryModal.jsx'

const GRADE_BADGE = {
  '중1': 'bg-sky-50 text-sky-700 border-sky-200',
  '중2': 'bg-violet-50 text-violet-700 border-violet-200',
  '중3': 'bg-rose-50 text-rose-700 border-rose-200',
}

function formatDateKey(iso) {
  if (!iso) return '날짜 없음'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '날짜 없음'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateLabel(key) {
  if (key === '날짜 없음') return key
  const [, m, d] = key.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

export default function QuizSetManagement() {
  const {
    data,
    createQuizSet,
    updateQuizSet,
    duplicateQuizSetShuffled,
    deleteQuizSet,
    createQuizQuestion,
    updateQuizQuestion,
    deleteQuizQuestion,
    upsertScoreOnlyAttempt,
  } = useData()

  const { currentUser } = useAuth()
  // 강사는 자기 과목 회차만 (각자 출제 페이지) — 관리자는 전체 + 과목 필터
  const mySubject = instructorQuizSubject(currentUser)
  const [subjectFilter, setSubjectFilter] = useState('전체')
  const defaultSubject = mySubject
    ?? (QUIZ_SUBJECTS.includes(currentUser?.subject) ? currentUser.subject : DEFAULT_QUIZ_SUBJECT)

  const [creatingSet, setCreatingSet] = useState(false)
  const [editingSet, setEditingSet] = useState(null)
  const [viewingSetId, setViewingSetId] = useState(null)
  const [confirmDeleteSet, setConfirmDeleteSet] = useState(null)
  const [togglingSetId, setTogglingSetId] = useState(null)
  const [duplicatingSetId, setDuplicatingSetId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [scoreEntrySetId, setScoreEntrySetId] = useState(null)

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

  // 강사: 자기 과목만 / 관리자: 과목 필터 적용
  const scopedSets = useMemo(() => {
    if (mySubject) return data.quizSets.filter((s) => s.subject === mySubject)
    if (subjectFilter !== '전체') return data.quizSets.filter((s) => s.subject === subjectFilter)
    return data.quizSets
  }, [data.quizSets, mySubject, subjectFilter])

  // 일자(내림차순) → 학년 → 회차 정렬 후 일자별 그룹으로 묶기
  const dateGroups = useMemo(() => {
    const sorted = [...scopedSets].sort((a, b) => {
      const dateA = formatDateKey(a.createdAt)
      const dateB = formatDateKey(b.createdAt)
      if (dateA !== dateB) return dateB.localeCompare(dateA) // 최신 일자가 위로
      const subjectCmp = (a.subject ?? '').localeCompare(b.subject ?? '')
      if (subjectCmp !== 0) return subjectCmp
      const gradeCmp = (a.grade ?? '').localeCompare(b.grade ?? '')
      if (gradeCmp !== 0) return gradeCmp
      return (a.round ?? 0) - (b.round ?? 0)
    })
    const groups = []
    sorted.forEach((set) => {
      const key = formatDateKey(set.createdAt)
      const last = groups[groups.length - 1]
      if (last && last.dateKey === key) {
        last.sets.push(set)
      } else {
        groups.push({ dateKey: key, sets: [set] })
      }
    })
    return groups
  }, [scopedSets])

  const allSets = useMemo(() => dateGroups.flatMap((g) => g.sets), [dateGroups])
  const viewingSet = viewingSetId ? allSets.find((s) => s.id === viewingSetId) : null
  const viewingQuestions = viewingSetId ? (questionsBySet[viewingSetId] ?? []) : []
  const viewingAttemptCount = viewingSetId ? (attemptsBySet[viewingSetId] ?? 0) : 0

  const handleDuplicate = async (set) => {
    const questionCount = (questionsBySet[set.id] ?? []).length
    if (questionCount === 0) {
      alert('소속 문제가 없는 회차는 복제할 수 없습니다.')
      return
    }
    setDuplicatingSetId(set.id)
    try {
      await duplicateQuizSetShuffled(set.id)
    } catch (err) {
      console.error('회차 복제 실패:', err)
      alert(err?.message ?? '복제 중 오류가 발생했습니다.')
    } finally {
      setDuplicatingSetId(null)
    }
  }

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
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-emerald-600" />
          <h2 className="text-sm font-bold text-gray-800">
            {mySubject ? `${mySubject} 회차/문제 관리` : '회차/문제 관리'}
          </h2>
          <span className="text-[11px] text-gray-400 ml-1">총 {allSets.length}개 회차</span>
        </div>
        <button
          onClick={() => setCreatingSet(true)}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white flex items-center gap-1 hover:bg-emerald-700"
        >
          <Plus size={14} />
          새 회차
        </button>
      </div>

      {/* 관리자 전용 과목 필터 — 강사는 자기 과목으로 자동 스코핑 */}
      {!mySubject && (
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-gray-50 overflow-x-auto">
          {['전체', ...QUIZ_SUBJECTS].map((s) => (
            <button
              key={s}
              onClick={() => setSubjectFilter(s)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition flex-shrink-0 ${
                subjectFilter === s
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {allSets.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-400">
          아직 등록된 회차가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5 w-28">생성일</th>
                <th className="text-left px-3 py-2.5 w-16">과목</th>
                <th className="text-left px-3 py-2.5 w-16">학년</th>
                <th className="text-left px-3 py-2.5 w-14">회차</th>
                <th className="text-left px-3 py-2.5">제목</th>
                <th className="text-right px-3 py-2.5 w-20">문제</th>
                <th className="text-right px-3 py-2.5 w-20">응시</th>
                <th className="text-left px-3 py-2.5 w-40">출처</th>
                <th className="text-center px-3 py-2.5 w-20">배포</th>
                <th className="text-right px-4 py-2.5 w-44">액션</th>
              </tr>
            </thead>
            <tbody>
              {dateGroups.map((group) => (
                group.sets.map((set, idxInGroup) => {
                  const questionCount = (questionsBySet[set.id] ?? []).length
                  const attemptCount = attemptsBySet[set.id] ?? 0
                  const isFirstOfDate = idxInGroup === 0
                  const gradeClass = GRADE_BADGE[set.grade] ?? 'bg-gray-50 text-gray-700 border-gray-200'

                  return (
                    <tr
                      key={set.id}
                      className={`border-t border-gray-100 hover:bg-gray-50/60 ${isFirstOfDate ? 'border-t-gray-200' : ''}`}
                    >
                      <td className="px-4 py-3 align-top">
                        {isFirstOfDate ? (
                          <div>
                            <p className="text-xs font-bold text-gray-700">{formatDateLabel(group.dateKey)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{group.dateKey}</p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-300">↑ 동일</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold ${SUBJECT_BADGE[set.subject] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {set.subject ?? '국어'}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold ${gradeClass}`}>
                          {set.grade}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="text-sm font-bold text-gray-800 tabular-nums">{set.round}회</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="text-sm font-semibold text-gray-800">
                          {set.title}
                          {set.isScoreOnly && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-bold align-middle">
                              외부시험
                            </span>
                          )}
                        </p>
                        {set.description && (
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{set.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        {set.isScoreOnly ? (
                          <span className="text-[11px] text-gray-500">만점 {set.maxScore}점</span>
                        ) : (
                          <>
                            <span className="text-sm font-semibold text-gray-700 tabular-nums">{questionCount}</span>
                            <span className="text-[11px] text-gray-400 ml-0.5">개</span>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <span className="text-sm font-semibold text-gray-700 tabular-nums">{attemptCount}</span>
                        <span className="text-[11px] text-gray-400 ml-0.5">명</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {set.source ? (
                          <p className="text-[11px] text-gray-500 line-clamp-1" title={set.source}>{set.source}</p>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-center">
                        <button
                          onClick={() => handleTogglePublish(set)}
                          disabled={togglingSetId === set.id}
                          className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                          title={set.isPublished ? '배포 중 (클릭하여 OFF)' : '미배포 (클릭하여 ON)'}
                        >
                          {set.isPublished
                            ? <ToggleRight size={22} className="text-emerald-600" />
                            : <ToggleLeft  size={22} className="text-gray-400" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          {set.isScoreOnly ? (
                            <button
                              onClick={() => setScoreEntrySetId(set.id)}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600"
                              title="점수 입력 (외부 시험)"
                            >
                              <ClipboardEdit size={16} />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => setViewingSetId(set.id)}
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                                title="문제 보기"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => handleDuplicate(set)}
                                disabled={duplicatingSetId === set.id || questionCount === 0}
                                className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 disabled:opacity-40"
                                title={questionCount === 0 ? '문제가 없어 복제할 수 없습니다' : '순서 셔플 복제 (새 회차로 생성, 미배포)'}
                              >
                                <Shuffle size={16} />
                              </button>
                            </>
                          )}
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
                      </td>
                    </tr>
                  )
                })
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creatingSet && (
        <QuizSetEditModal
          mode="create"
          defaultSubject={defaultSubject}
          lockSubject={!!mySubject}
          onSubmit={createQuizSet}
          onClose={() => setCreatingSet(false)}
        />
      )}

      {editingSet && (
        <QuizSetEditModal
          mode="edit"
          initial={editingSet}
          lockSubject={!!mySubject}
          onSubmit={(payload) => updateQuizSet(editingSet.id, payload)}
          onClose={() => setEditingSet(null)}
        />
      )}

      {scoreEntrySetId && (() => {
        const set = allSets.find((s) => s.id === scoreEntrySetId)
        return set ? (
          <QuizScoreEntryModal
            quizSet={set}
            students={data.students ?? []}
            attempts={data.quizAttempts.filter((a) => a.quizSetId === set.id)}
            onUpsertScore={(studentId, quizSetId, score) => upsertScoreOnlyAttempt(studentId, quizSetId, score)}
            onClose={() => setScoreEntrySetId(null)}
          />
        ) : null
      })()}

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
                      응시 기록 {attemptsBySet[confirmDeleteSet.id]}건도 함께 삭제됩니다 (복구 불가).
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
