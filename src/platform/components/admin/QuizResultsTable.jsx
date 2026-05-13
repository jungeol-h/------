import { useState, useMemo } from 'react'
import { X, CheckCircle2, XCircle, FileText } from 'lucide-react'

// props:
//   attempts: QuizAttempt[]   — 표시할 응시 이력
//   students: User[]          — id로 학생 매핑 (학생 이름·학년 표시)
//   quizSets: QuizSet[]       — id로 회차 매핑 (회차 제목 표시)
//   quizQuestions: QuizQuestion[] — 상세 모달용
//   emptyMessage?: string
export default function QuizResultsTable({ attempts, students, quizSets, quizQuestions, emptyMessage }) {
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterSetId, setFilterSetId] = useState('all')
  const [openAttempt, setOpenAttempt] = useState(null)

  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students])
  const setById     = useMemo(() => Object.fromEntries(quizSets.map((s) => [s.id, s])), [quizSets])
  const questionsBySet = useMemo(() => {
    const map = {}
    quizQuestions.forEach((q) => {
      if (!map[q.quizSetId]) map[q.quizSetId] = []
      map[q.quizSetId].push(q)
    })
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.orderNo - b.orderNo))
    return map
  }, [quizQuestions])

  const grades = useMemo(() => {
    const set = new Set(quizSets.map((s) => s.grade).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [quizSets])

  const filtered = useMemo(() => {
    return attempts
      .filter((a) => {
        if (filterSetId !== 'all' && a.quizSetId !== filterSetId) return false
        if (filterGrade !== 'all') {
          const s = setById[a.quizSetId]
          if (!s || s.grade !== filterGrade) return false
        }
        return true
      })
      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
  }, [attempts, filterGrade, filterSetId, setById])

  const setOptions = useMemo(() => {
    if (filterGrade === 'all') return quizSets
    return quizSets.filter((s) => s.grade === filterGrade)
  }, [quizSets, filterGrade])

  const openSet = openAttempt ? setById[openAttempt.quizSetId] : null
  const openQuestions = openAttempt ? (questionsBySet[openAttempt.quizSetId] || []) : []
  const openAnswerMap = openAttempt ? Object.fromEntries(openAttempt.answers.map((x) => [x.questionId, x])) : {}
  const openStudent = openAttempt ? studentById[openAttempt.studentId] : null

  return (
    <div className="space-y-3">
      {/* 필터 */}
      <div className="flex gap-2 text-xs">
        <select
          value={filterGrade}
          onChange={(e) => { setFilterGrade(e.target.value); setFilterSetId('all') }}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white"
        >
          {grades.map((g) => (
            <option key={g} value={g}>{g === 'all' ? '전체 학년' : g}</option>
          ))}
        </select>
        <select
          value={filterSetId}
          onChange={(e) => setFilterSetId(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white"
        >
          <option value="all">전체 회차</option>
          {setOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      {/* 테이블 (모바일도 고려한 카드 + 데스크탑 테이블 하이브리드) */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-sm text-gray-400">
          {emptyMessage || '응시 이력이 없습니다.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* 데스크탑 헤더 */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
            <div className="col-span-3">학생</div>
            <div className="col-span-1">학년</div>
            <div className="col-span-4">회차</div>
            <div className="col-span-2">점수</div>
            <div className="col-span-2">제출일</div>
          </div>
          <ul className="divide-y divide-gray-100">
            {filtered.map((a) => {
              const stu = studentById[a.studentId]
              const set = setById[a.quizSetId]
              const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0
              const submitted = a.submittedAt ? a.submittedAt.slice(0, 10) : '—'
              return (
                <li key={a.id}>
                  <button
                    onClick={() => setOpenAttempt(a)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <div className="sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center flex flex-col gap-1">
                      <p className="sm:col-span-3 text-sm font-semibold text-gray-800">{stu?.name ?? a.studentId}</p>
                      <p className="sm:col-span-1 text-xs text-gray-500">{stu?.grade ?? '—'}</p>
                      <p className="sm:col-span-4 text-xs text-gray-600 truncate">{set?.title ?? a.quizSetId}</p>
                      <p className="sm:col-span-2 text-sm font-bold">
                        <span className={pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600'}>
                          {a.score} / {a.total}
                        </span>
                        <span className="text-[11px] text-gray-400 ml-1">({pct}%)</span>
                      </p>
                      <p className="sm:col-span-2 text-xs text-gray-400">{submitted}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 상세 모달 */}
      {openAttempt && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-gray-800">{openStudent?.name ?? openAttempt.studentId}</p>
                  <p className="text-[11px] text-gray-500">{openSet?.title}</p>
                </div>
              </div>
              <button onClick={() => setOpenAttempt(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-2">
              <div className="bg-emerald-50 rounded-xl p-3 mb-1">
                <p className="text-xs text-emerald-700">
                  <span className="font-bold">{openAttempt.score} / {openAttempt.total}</span>
                  <span className="ml-1">정답</span>
                  <span className="ml-2 text-emerald-600">
                    ({openAttempt.total > 0 ? Math.round(openAttempt.score / openAttempt.total * 100) : 0}%)
                  </span>
                </p>
                <p className="text-[11px] text-emerald-600 mt-0.5">
                  제출 {openAttempt.submittedAt ? openAttempt.submittedAt.slice(0, 16).replace('T', ' ') : '—'}
                </p>
              </div>

              {openQuestions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">문제 정보를 불러오지 못했습니다.</p>
              ) : (
                openQuestions.map((q) => {
                  const ans = openAnswerMap[q.id]
                  const ok = ans?.isCorrect
                  return (
                    <div key={q.id} className={`rounded-xl p-3 border ${ok ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-100 bg-red-50/40'}`}>
                      <div className="flex items-start gap-2 mb-1.5">
                        {ok
                          ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                          : <XCircle    size={16} className="text-red-500     flex-shrink-0 mt-0.5" />
                        }
                        <p className="text-xs text-gray-800 leading-relaxed">
                          <span className="text-[10px] font-bold text-gray-400 mr-1">Q{q.orderNo}.</span>
                          {q.question}
                        </p>
                      </div>
                      <div className="ml-5 text-[11px] space-y-0.5">
                        <p>
                          <span className="text-gray-400">답: </span>
                          <span className={ok ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                            {ans?.raw || '(미입력)'}
                          </span>
                        </p>
                        <p>
                          <span className="text-gray-400">정답: </span>
                          <span className="text-gray-800 font-semibold">{q.acceptedAnswers[0]}</span>
                          {q.acceptedAnswers.length > 1 && (
                            <span className="text-gray-400"> · {q.acceptedAnswers.slice(1).join(', ')}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={() => setOpenAttempt(null)}
                className="w-full py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
