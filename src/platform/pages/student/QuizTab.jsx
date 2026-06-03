import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ClipboardCheck, CheckCircle2, XCircle, RotateCcw, Loader } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'

const DRAFT_PREFIX = 'quiz_draft'

function getDraftKey(studentId, setId) {
  if (!studentId || !setId) return null
  return `${DRAFT_PREFIX}:${studentId}:${setId}`
}

function readDraft(key) {
  if (!key) return null
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return null
    return {
      step: Number.isInteger(parsed.step) ? parsed.step : 0,
      rawByQid: parsed.rawByQid && typeof parsed.rawByQid === 'object' ? parsed.rawByQid : {},
    }
  } catch {
    return null
  }
}

function removeDraft(key) {
  if (!key) return
  try {
    localStorage.removeItem(key)
  } catch {
    // localStorage 접근 실패는 응시 흐름을 막지 않는다.
  }
}

export default function QuizTab() {
  const { currentUser } = useAuth()
  const { data, submitQuizAttempt } = useData()

  const studentId = currentUser?.id
  const myGrade = currentUser?.grade ?? data.students.find((s) => s.id === studentId)?.grade ?? ''

  // 학생 본인 학년 회차만
  const mySets = useMemo(
    () => data.quizSets
      .filter((s) => s.grade === myGrade && s.isPublished)
      .sort((a, b) => a.round - b.round),
    [data.quizSets, myGrade]
  )

  const myAttempts = useMemo(
    () => data.quizAttempts.filter((a) => a.studentId === studentId),
    [data.quizAttempts, studentId]
  )

  const [activeSetId, setActiveSetId] = useState(null)
  const [mode, setMode] = useState('list') // 'list' | 'playing' | 'result'
  const [step, setStep] = useState(0)
  const [rawByQid, setRawByQid] = useState({})
  const [resultAttempt, setResultAttempt] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const activeSet = mySets.find((s) => s.id === activeSetId)
  const activeQuestions = useMemo(
    () => data.quizQuestions
      .filter((q) => q.quizSetId === activeSetId)
      .sort((a, b) => a.orderNo - b.orderNo),
    [data.quizQuestions, activeSetId]
  )
  // 결과 화면에서 응시 기록의 questionId로 문제 본문 lookup
  const activeQuestionsById = useMemo(
    () => Object.fromEntries(activeQuestions.map((q) => [q.id, q])),
    [activeQuestions]
  )
  const draftKey = useMemo(() => getDraftKey(studentId, activeSetId), [studentId, activeSetId])
  const hasDraftAnswer = useMemo(
    () => Object.values(rawByQid).some((v) => String(v ?? '').trim().length > 0),
    [rawByQid]
  )

  useEffect(() => {
    if (mode !== 'playing' || !draftKey) return
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ step, rawByQid, updatedAt: new Date().toISOString() })
      )
    } catch {
      // 저장 공간 부족 등은 사용자 응시를 막지 않는다.
    }
  }, [draftKey, mode, rawByQid, step])

  useEffect(() => {
    if (mode !== 'playing' || !hasDraftAnswer) return
    const handleBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasDraftAnswer, mode])

  useEffect(() => {
    if (mode !== 'playing' || activeQuestions.length === 0) return
    if (step >= activeQuestions.length) setStep(activeQuestions.length - 1)
  }, [activeQuestions.length, mode, step])

  function openSet(setId) {
    const existing = myAttempts.find((a) => a.quizSetId === setId)
    const nextDraftKey = getDraftKey(studentId, setId)
    const draft = readDraft(nextDraftKey)
    setActiveSetId(setId)
    if (existing) {
      removeDraft(nextDraftKey)
      setStep(0)
      setResultAttempt(existing)
      setMode('result')
    } else {
      setStep(draft?.step ?? 0)
      setRawByQid(draft?.rawByQid ?? {})
      setMode('playing')
    }
  }

  function backToList({ clearDraft = false } = {}) {
    if (clearDraft) removeDraft(draftKey)
    setActiveSetId(null)
    setMode('list')
    setResultAttempt(null)
    setRawByQid({})
    setStep(0)
  }

  function setRaw(qid, value) {
    setRawByQid((prev) => ({ ...prev, [qid]: value }))
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    try {
      const attempt = await submitQuizAttempt(studentId, activeSetId, rawByQid)
      removeDraft(draftKey)
      setResultAttempt(attempt)
      setMode('result')
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSubmitting(false)
    }
  }

  function confirmCancelAttempt() {
    if (hasDraftAnswer && !window.confirm('응시를 취소하면 입력한 답안이 사라집니다. 정말 나가시겠습니까?')) {
      return
    }
    backToList({ clearDraft: true })
  }

  // ── 목록 화면 ──────────────────────────────────────────────
  if (mode === 'list') {
    return (
      <div className="py-6 space-y-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <p className="text-xs opacity-80">확인평가</p>
              <h2 className="text-lg font-bold">{myGrade || '학년 미설정'} 쪽지시험</h2>
            </div>
          </div>
          <p className="text-xs opacity-80 leading-relaxed">
            교재 개념을 단답형으로 점검합니다. 회차당 1회만 응시할 수 있습니다.
          </p>
        </div>

        {mySets.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center text-sm text-gray-400">
            아직 배포된 회차가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {mySets.map((s) => {
              const attempt = myAttempts.find((a) => a.quizSetId === s.id)
              const done = !!attempt
              return (
                <button
                  key={s.id}
                  onClick={() => openSet(s.id)}
                  className="w-full text-left bg-white rounded-2xl p-4 border border-gray-100 shadow-sm active:scale-[0.98] transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-bold text-gray-800 text-sm">{s.title}</p>
                    {done ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                        응시 완료
                      </span>
                    ) : (
                      <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                        미응시
                      </span>
                    )}
                  </div>
                  {s.description && <p className="text-xs text-gray-500 leading-relaxed">{s.description}</p>}
                  {done && (
                    <p className="text-xs text-emerald-600 font-semibold mt-2">
                      {attempt.score} / {attempt.total} 점 · 결과 보기
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── 응시 화면 ──────────────────────────────────────────────
  if (mode === 'playing' && activeSet) {
    if (activeQuestions.length === 0) {
      return (
        <div className="py-6 text-center text-sm text-gray-400">
          문제를 불러오는 중...
          <button onClick={confirmCancelAttempt} className="block mx-auto mt-4 text-indigo-600 text-xs">목록으로</button>
        </div>
      )
    }

    const q = activeQuestions[step]
    const progress = ((step + 1) / activeQuestions.length) * 100
    const currentValue = rawByQid[q.id] ?? ''
    const isLast = step === activeQuestions.length - 1
    const canNext = currentValue.trim().length > 0
    const unanswered = activeQuestions.filter((qq) => !(rawByQid[qq.id] ?? '').trim()).length

    return (
      <div className="py-4 space-y-4 px-1">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{step + 1} / {activeQuestions.length}</span>
            <span className="truncate ml-2">{activeSet.title}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 min-h-[120px]">
          <p className="text-[11px] font-bold text-emerald-600 mb-2">문제 {step + 1}</p>
          <p className="text-sm font-medium text-gray-800 leading-relaxed whitespace-pre-wrap">{q.question}</p>
          {q.hint && <p className="text-xs text-gray-400 mt-2">힌트: {q.hint}</p>}
        </div>

        <div>
          <input
            type="text"
            value={currentValue}
            onChange={(e) => setRaw(q.id, e.target.value)}
            placeholder="정답을 입력하세요"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-400 bg-white"
            autoFocus
          />
          <p className="text-[11px] text-gray-400 mt-1.5 px-1">
            공백과 대소문자는 채점 시 무시됩니다.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 disabled:opacity-30"
          >
            <ChevronLeft size={16} /> 이전
          </button>
          {!isLast ? (
            <button
              onClick={() => setStep((s) => Math.min(activeQuestions.length - 1, s + 1))}
              disabled={!canNext}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              다음 <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canNext}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              {submitting ? (<><Loader size={14} className="animate-spin" /> 제출 중...</>) : '제출하기'}
            </button>
          )}
        </div>

        {isLast && unanswered > 0 && (
          <p className="text-xs text-amber-600 text-center">
            미입력 문항 {unanswered}개가 있습니다. 빈 답안은 오답 처리됩니다.
          </p>
        )}

        <div className="pt-6">
          <button
            onClick={confirmCancelAttempt}
            className="block w-full text-xs text-gray-400 py-3 underline underline-offset-2"
          >
          나가기 (응시 취소)
          </button>
        </div>
      </div>
    )
  }

  // ── 결과 화면 ──────────────────────────────────────────────
  if (mode === 'result' && activeSet && resultAttempt) {
    const pct = resultAttempt.total > 0 ? Math.round((resultAttempt.score / resultAttempt.total) * 100) : 0

    return (
      <div className="py-4 space-y-4 px-1">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
          <p className="text-xs opacity-80 mb-1">{activeSet.title}</p>
          <div className="flex items-end gap-2">
            <h2 className="text-3xl font-bold">{resultAttempt.score}</h2>
            <p className="text-sm opacity-80 pb-1">/ {resultAttempt.total} 정답</p>
            <span className="ml-auto text-sm font-bold bg-white/20 rounded-full px-2.5 py-0.5">{pct}%</span>
          </div>
        </div>

        <div className="space-y-2">
          {resultAttempt.answers.map((a, idx) => {
            const q = activeQuestionsById[a.questionId]
            if (!q) return null
            const ok = a.isCorrect
            return (
              <div
                key={a.questionId}
                className={`bg-white rounded-2xl p-4 border ${ok ? 'border-emerald-100' : 'border-red-100'}`}
              >
                <div className="flex items-start gap-2 mb-2">
                  {ok
                    ? <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    : <XCircle    size={18} className="text-red-500     flex-shrink-0 mt-0.5" />
                  }
                  <p className="text-sm text-gray-800 leading-relaxed flex-1">
                    <span className="text-[11px] font-bold text-gray-400 mr-1">Q{idx + 1}.</span>
                    {q.question}
                  </p>
                </div>
                <div className="space-y-1 text-xs ml-6">
                  <p>
                    <span className="text-gray-400">내 답: </span>
                    <span className={ok ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                      {a?.raw || '(미입력)'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400">정답: </span>
                    <span className="text-gray-800 font-semibold">{q.acceptedAnswers[0]}</span>
                    {q.acceptedAnswers.length > 1 && (
                      <span className="text-gray-400"> (또는 {q.acceptedAnswers.slice(1).join(', ')})</span>
                    )}
                  </p>
                  {q.explanation && (
                    <p className="text-gray-500 leading-relaxed pt-1">
                      <span className="text-gray-400">해설: </span>{q.explanation}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={backToList}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-sm text-gray-500"
        >
          <RotateCcw size={14} /> 확인평가 목록
        </button>
      </div>
    )
  }

  return null
}
