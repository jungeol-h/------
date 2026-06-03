import { useState, useEffect, useRef } from 'react'
import {
  Play, Pause, RotateCcw, Save, Check, Clock, Plus, ChevronDown, ChevronUp,
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { toDateStr } from '../../context/selectors/weeklyLearning.js'
import {
  STUDY_METHODS,
  actualMinutes,
  subjectBreakdown,
} from '../../context/selectors/learningRecords.js'

const SUBJECTS = [
  '국어', '영어', '수학', '과학', '사회', '도덕',
  '역사(한국사)', '기술가정', '한문', '정보',
  '교양 독서', '진로 독서', '진로 탐구',
]

const SUBJECT_COLORS = [
  '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed',
  '#0891b2', '#65a30d', '#ea580c', '#db2777', '#0d9488',
  '#4f46e5', '#9333ea', '#57534e',
]

const TIME_STEPS = [
  { label: '-10', value: -10 },
  { label: '+10', value: 10 },
  { label: '+30', value: 30 },
  { label: '+1시간', value: 60 },
]

const EMPTY_PLAN = {
  subject: '',
  studyMethod: '',
  content: '',
  plannedMin: '',
}

const DEFAULT_TIMER_FORM = {
  subject: '수학',
  studyMethod: '',
  focus: '',
  content: '',
}

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

function minutesLabel(minutes) {
  if (!minutes) return ''
  return `${minutes}분`
}

function TimePresetControl({ label, value, onChange, onCommit, tone = 'blue' }) {
  const activeValue = Number(value || 0)
  const activeClass = tone === 'green'
    ? 'bg-emerald-600 text-white border-emerald-600'
    : 'bg-blue-600 text-white border-blue-600'

  const handleStep = (delta) => {
    const next = Math.max(0, activeValue + delta)
    const nextValue = next > 0 ? String(next) : ''
    onChange(nextValue)
    onCommit(nextValue)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-gray-500">{label}</span>
        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
          activeValue > 0 ? activeClass : 'bg-gray-100 border border-gray-200 text-gray-400'
        }`}>
          {activeValue > 0 ? `${activeValue}분` : '미입력'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {TIME_STEPS.map((step) => (
          <button
            key={step.label}
            type="button"
            onClick={() => handleStep(step.value)}
            disabled={activeValue === 0 && step.value < 0}
            className="h-9 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 disabled:bg-gray-100 disabled:text-gray-300 active:scale-95"
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ChipGroup({ options, value, onChange, tone = 'blue' }) {
  const activeClass = tone === 'green'
    ? 'bg-emerald-600 text-white border-emerald-600'
    : 'bg-blue-600 text-white border-blue-600'
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
            value === option
              ? activeClass
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          {option || '미분류'}
        </button>
      ))}
    </div>
  )
}

function PlannerSection({ studentId, records }) {
  const { addLearningPlan, completeLearningPlan, updateLearningRecord } = useData()
  const today = toDateStr(new Date())
  const todayPlans = records
    .filter((r) => r.studentId === studentId && r.date === today && r.recordType === 'planner')
    .slice()
    .sort((a, b) => (a.id > b.id ? 1 : -1))
  const [drafts, setDrafts] = useState({})
  const [editValues, setEditValues] = useState({})
  const [actualModes, setActualModes] = useState({})
  const [addingDraft, setAddingDraft] = useState(false)
  const [openRowKey, setOpenRowKey] = useState(null)
  const [completionWarning, setCompletionWarning] = useState(null)
  const [rowTimer, setRowTimer] = useState(null)
  const timerRef = useRef(null)
  const activeRowKey = rowTimer?.key

  const doneCount = todayPlans.filter((item) => item.status === 'done').length
  const rows = [
    ...todayPlans.map((record) => ({ key: record.id, record })),
    ...(addingDraft ? [{ key: 'draft-new', draft: drafts['draft-new'] ?? EMPTY_PLAN }] : []),
  ]

  useEffect(() => {
    if (activeRowKey) {
      timerRef.current = setInterval(() => {
        setRowTimer((timer) => timer ? { ...timer, seconds: timer.seconds + 1 } : null)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [activeRowKey])

  const updateDraft = (key, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? EMPTY_PLAN), ...patch },
    }))
  }

  const rowValue = (row, field) => {
    if (editValues[row.key]?.[field] !== undefined) return editValues[row.key][field]
    if (row.record) {
      if (field === 'plannedMin') return row.record.plannedMin ?? ''
      return row.record[field] ?? ''
    }
    return row.draft[field] ?? ''
  }

  const updateEditValue = (key, patch) => {
    setEditValues((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), ...patch },
    }))
  }

  const commitField = async (row, field, overrideValue) => {
    const value = overrideValue ?? editValues[row.key]?.[field]
    if (value === undefined) return
    if (row.record) {
      const patchValue = field === 'plannedMin' && value ? Number(value) : value
      try {
        await updateLearningRecord(row.record.id, { [field]: patchValue || null })
      } catch {
        // 저장 실패는 전역 Toast가 표면화한다.
      }
      return
    }
    const nextDraft = { ...(drafts[row.key] ?? EMPTY_PLAN), ...(editValues[row.key] ?? {}), [field]: value }
    updateDraft(row.key, { [field]: value })
    await ensureDraftSaved(row.key, nextDraft)
  }

  const ensureDraftSaved = async (key, draftOverride = null) => {
    const draft = draftOverride ?? { ...(drafts[key] ?? EMPTY_PLAN), ...(editValues[key] ?? {}) }
    if (draft.savedId) return draft.savedId
    if (!draft.subject) return null
    try {
      const record = await addLearningPlan(studentId, {
        subject: draft.subject,
        studyMethod: draft.studyMethod,
        content: draft.content?.trim() ?? '',
        plannedMin: draft.plannedMin ? Number(draft.plannedMin) : null,
      })
      setDrafts((prev) => ({
        ...prev,
        [key]: EMPTY_PLAN,
      }))
      setEditValues((prev) => ({
        ...prev,
        [key]: {},
      }))
      setAddingDraft(false)
      setOpenRowKey(record.id)
      return record.id
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
      return null
    }
  }

  const handleCellChange = async (row, field, value) => {
    if (row.record) {
      const patchValue = field === 'plannedMin' && value ? Number(value) : value
      await updateLearningRecord(row.record.id, { [field]: patchValue || null })
      return
    }
    const nextDraft = { ...(drafts[row.key] ?? EMPTY_PLAN), [field]: value }
    updateDraft(row.key, { [field]: value })
    if (field === 'subject') await ensureDraftSaved(row.key, nextDraft)
  }

  const handleDraftBlur = async (row) => {
    if (!row.record) await ensureDraftSaved(row.key)
  }

  const commitActual = async (row) => {
    const value = editValues[row.key]?.actualDuration
    if (value === undefined) return
    const recordId = row.record?.id ?? await ensureDraftSaved(row.key)
    if (!recordId) return
    try {
      await updateLearningRecord(recordId, { actualDuration: value ? Number(value) : null })
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    }
  }

  const handleComplete = async (row) => {
    await commitActual(row)
    const recordId = row.record?.id ?? await ensureDraftSaved(row.key)
    if (!recordId) return
    try {
      await completeLearningPlan(recordId)
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    }
  }

  const handleTimerToggle = async (row) => {
    if (rowTimer?.key === row.key) {
      const minutes = Math.max(1, Math.round(rowTimer.seconds / 60))
      const recordId = row.record?.id ?? await ensureDraftSaved(row.key)
      if (!recordId) return
      const previous = row.record ? actualMinutes(row.record) : 0
      setRowTimer(null)
      try {
        await updateLearningRecord(recordId, { actualDuration: previous + minutes })
      } catch {
        // 저장 실패는 전역 Toast가 표면화한다.
      }
      return
    }
    if (!rowValue(row, 'subject')) return
    setRowTimer({ key: row.key, seconds: 0 })
  }

  const handleActualBlur = async (row, value) => {
    updateEditValue(row.key, { actualDuration: value })
    const recordId = row.record?.id ?? await ensureDraftSaved(row.key)
    if (!recordId) return
    try {
      await updateLearningRecord(recordId, { actualDuration: value ? Number(value) : null })
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    }
  }

  const actualValueFor = (row) => {
    if (editValues[row.key]?.actualDuration !== undefined) {
      return Number(editValues[row.key].actualDuration || 0)
    }
    return row.record ? actualMinutes(row.record) : 0
  }

  const requestComplete = async (row) => {
    const planned = Number(rowValue(row, 'plannedMin') || 0)
    const actual = actualValueFor(row)
    if (planned > 0 && actual < planned) {
      setCompletionWarning({ row, planned, actual })
      return
    }
    await handleComplete(row)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">오늘의 학습 계획</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            한 줄씩 채우고 행별 타이머로 실행을 기록합니다 · {doneCount}/{todayPlans.length} 완료
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-5 text-center">
            <p className="text-sm font-semibold text-gray-500">오늘 계획이 아직 없습니다.</p>
          </div>
        )}
        {rows.map((row, index) => {
          const isDone = row.record?.status === 'done'
          const timerActive = rowTimer?.key === row.key
          const actual = row.record ? actualMinutes(row.record) : 0
          const actualInput = editValues[row.key]?.actualDuration ?? (actual || '')
          const subject = rowValue(row, 'subject')
          const studyMethod = rowValue(row, 'studyMethod')
          const content = rowValue(row, 'content')
          const plannedMin = rowValue(row, 'plannedMin')
          const isOpen = openRowKey === row.key
          const actualMode = actualModes[row.key] ?? 'manual'
          return (
            <div
              key={row.key}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                isDone ? 'border-blue-100' : 'border-gray-100'
              }`}
            >
              <div className={`p-2.5 ${isDone ? 'bg-blue-50/60' : 'bg-white'}`}>
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenRowKey(isOpen ? null : row.key)}
                    className={`w-7 h-7 mt-0.5 rounded-lg border flex items-center justify-center flex-shrink-0 ${
                      isDone ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-300'
                    }`}
                    aria-label={isOpen ? '편집 닫기' : '편집 열기'}
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenRowKey(isOpen ? null : row.key)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-bold ${subject ? 'text-gray-900' : 'text-gray-400'}`}>
                        {subject || `${index + 1}번째 계획`}
                      </span>
                      {studyMethod && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                          {studyMethod}
                        </span>
                      )}
                      {plannedMin && <span className="text-[11px] text-gray-400">목표 {plannedMin}분</span>}
                      {actual > 0 && <span className="text-[11px] text-blue-600 font-bold">학습 {actual}분</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {content || '카드를 눌러 과목, 학습법, 내용을 채우세요'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenRowKey(isOpen ? null : row.key)}
                    className="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 flex items-center justify-center flex-shrink-0"
                    aria-label={isOpen ? '편집 닫기' : '편집 열기'}
                  >
                    {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold text-gray-500">과목</span>
                      <select
                        value={subject}
                        onChange={(e) => handleCellChange(row, 'subject', e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400"
                      >
                        <option value="">선택</option>
                        {SUBJECTS.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold text-gray-500">학습법</span>
                      <select
                        value={studyMethod}
                        onChange={(e) => handleCellChange(row, 'studyMethod', e.target.value)}
                        onBlur={() => handleDraftBlur(row)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-emerald-400"
                      >
                        <option value="">선택</option>
                        {STUDY_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-[11px] font-bold text-gray-500">학습 내용</span>
                    <input
                      type="text"
                      value={content}
                      onChange={(e) => updateEditValue(row.key, { content: e.target.value })}
                      onBlur={() => commitField(row, 'content')}
                      placeholder="교재, 단원, 문제 수, 암기량"
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400"
                    />
                  </label>

                  <TimePresetControl
                    label="목표 시간"
                    value={plannedMin}
                    onChange={(value) => updateEditValue(row.key, { plannedMin: value })}
                    onCommit={(value) => commitField(row, 'plannedMin', value)}
                  />

                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-gray-500">실제 기록 방식</span>
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-white border border-gray-200 p-1">
                        <button
                          type="button"
                          onClick={() => setActualModes((prev) => ({ ...prev, [row.key]: 'manual' }))}
                          className={`h-8 rounded-md text-xs font-bold ${actualMode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                        >
                          직접
                        </button>
                        <button
                          type="button"
                          onClick={() => setActualModes((prev) => ({ ...prev, [row.key]: 'timer' }))}
                          className={`h-8 rounded-md text-xs font-bold ${actualMode === 'timer' ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}
                        >
                          타이머
                        </button>
                      </div>
                    </div>
                  </div>

                  {actualMode === 'manual' ? (
                    <TimePresetControl
                      label="학습 시간"
                      value={actualInput}
                      onChange={(value) => updateEditValue(row.key, { actualDuration: value })}
                      onCommit={(value) => handleActualBlur(row, value)}
                      tone="green"
                    />
                  ) : (
                    <div className="rounded-xl bg-white border border-gray-200 p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-gray-500 mb-1">타이머 기록</p>
                        <p className="text-sm font-bold text-gray-800">
                          {timerActive ? formatTime(rowTimer.seconds) : actual > 0 ? `${actual}분 기록됨` : '아직 기록 없음'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTimerToggle(row)}
                        disabled={!subject || (rowTimer && rowTimer.key !== row.key)}
                        className={`h-10 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-1 flex-shrink-0 disabled:bg-gray-100 disabled:text-gray-300 ${
                          timerActive ? 'bg-amber-300 text-amber-950' : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {timerActive ? <><Pause size={14} />정지</> : <><Play size={14} />시작</>}
                      </button>
                    </div>
                  )}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => requestComplete(row)}
                      disabled={!subject}
                      className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 active:scale-95"
                    >
                      목표 달성
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!addingDraft && (
          <button
            type="button"
            onClick={() => {
              setAddingDraft(true)
              setOpenRowKey('draft-new')
            }}
            className="w-full h-12 rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-500 text-sm font-bold flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-600 active:scale-[0.99]"
          >
            <Plus size={16} />
            계획 추가
          </button>
        )}
      </div>
      {rowTimer && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          실행 중인 행 타이머: {formatTime(rowTimer.seconds)}
        </div>
      )}
      {completionWarning && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-5">
            <h3 className="text-base font-bold text-gray-900">목표 시간보다 적게 기록됐습니다</h3>
            <p className="text-sm text-gray-600 mt-2">
              예상 {completionWarning.planned}분 중 실제 {completionWarning.actual}분이 기록되어 있습니다.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={() => setCompletionWarning(null)}
                className="h-10 rounded-lg bg-gray-100 text-gray-600 text-sm font-bold"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={async () => {
                  const row = completionWarning.row
                  setCompletionWarning(null)
                  await handleComplete(row)
                }}
                className="h-10 rounded-lg bg-blue-600 text-white text-sm font-bold"
              >
                그래도 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default function LearningTab() {
  const { currentUser } = useAuth()
  const { data, addTimerLearningRecord } = useData()

  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showTimerForm, setShowTimerForm] = useState(false)
  const [timerForm, setTimerForm] = useState(DEFAULT_TIMER_FORM)
  const [saved, setSaved] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const records = data.learningRecords.filter((r) => r.studentId === currentUser?.id)
  const timeRecords = records.filter((r) => actualMinutes(r) > 0)
  const totalMinutes = timeRecords.reduce((sum, r) => sum + actualMinutes(r), 0)
  const pieData = subjectBreakdown(timeRecords, SUBJECTS.length).map(({ name, minutes }) => ({
    name,
    value: minutes,
  }))

  const handleTimerFinish = () => {
    if (elapsed < 10) return
    setRunning(false)
    setShowTimerForm(true)
  }

  const handleTimerSave = async () => {
    if (elapsed < 10 || !timerForm.subject) return
    const minutes = Math.max(1, Math.round(elapsed / 60))
    try {
      await addTimerLearningRecord(currentUser.id, {
        subject: timerForm.subject,
        actualDuration: minutes,
        focus: timerForm.focus ? Number(timerForm.focus) : null,
        studyMethod: timerForm.studyMethod,
        content: timerForm.content.trim(),
      })
      setElapsed(0)
      setShowTimerForm(false)
      setTimerForm(DEFAULT_TIMER_FORM)
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    }
  }

  return (
    <div className="py-6 space-y-6">
      <PlannerSection studentId={currentUser?.id} records={data.learningRecords} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">학습 타이머</h2>
            <p className="text-xs text-gray-500 mt-0.5">타이머 종료 후 과목과 기록을 정리합니다</p>
          </div>
          <Clock size={20} className="text-gray-400" />
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-5xl font-mono font-bold tracking-widest text-center my-4">
            {formatTime(elapsed)}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setShowTimerForm(false)
                setRunning((r) => !r)
              }}
              className={`flex-1 py-3 rounded-lg font-bold text-sm transition-all active:scale-95 ${
                running ? 'bg-amber-300 text-amber-950' : 'bg-white text-blue-700'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {running ? <><Pause size={16} /> 일시정지</> : elapsed > 0 ? <><Play size={16} /> 재개</> : <><Play size={16} /> 시작</>}
              </span>
            </button>
            {elapsed >= 10 && (
              <button
                type="button"
                onClick={handleTimerFinish}
                className="flex-1 py-3 rounded-lg font-bold text-sm bg-white/95 text-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Save size={15} />
                기록하기
              </button>
            )}
            {elapsed > 0 && (
              <button
                type="button"
                onClick={() => {
                  setElapsed(0)
                  setRunning(false)
                  setShowTimerForm(false)
                }}
                className="px-4 py-3 rounded-lg font-bold text-sm bg-white/20 hover:bg-white/30 transition-all flex items-center justify-center"
                aria-label="타이머 초기화"
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>
        </div>

        {showTimerForm && (
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">과목</p>
              <ChipGroup
                options={SUBJECTS}
                value={timerForm.subject}
                onChange={(subject) => setTimerForm((prev) => ({ ...prev, subject }))}
              />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">학습법 (선택)</p>
              <ChipGroup
                options={['', ...STUDY_METHODS]}
                value={timerForm.studyMethod}
                onChange={(studyMethod) => setTimerForm((prev) => ({ ...prev, studyMethod }))}
                tone="green"
              />
            </div>
            <div className="grid grid-cols-[96px_1fr] gap-2">
              <input
                type="number"
                min="10"
                max="100"
                step="10"
                value={timerForm.focus}
                onChange={(e) => setTimerForm((prev) => ({ ...prev, focus: e.target.value }))}
                placeholder="집중도 %"
                className="h-11 text-sm px-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none"
              />
              <input
                type="text"
                value={timerForm.content}
                onChange={(e) => setTimerForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="학습내용 또는 분량 (선택)"
                className="h-11 text-sm px-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleTimerSave}
              className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold active:scale-95"
            >
              {saved ? '저장됨' : `${minutesLabel(Math.max(1, Math.round(elapsed / 60)))} 기록 저장`}
            </button>
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
        <div>
          <p className="text-xs text-gray-500">총 학습시간</p>
          <p className="text-2xl font-bold text-blue-600">{totalMinutes}<span className="text-sm font-normal text-gray-500">분</span></p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">기록 횟수</p>
          <p className="text-2xl font-bold text-emerald-600">{timeRecords.length}<span className="text-sm font-normal text-gray-500">회</span></p>
        </div>
      </section>

      {pieData.length > 0 ? (
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">과목별 학습 시간</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={SUBJECT_COLORS[SUBJECTS.indexOf(entry.name) >= 0 ? SUBJECTS.indexOf(entry.name) : index % SUBJECT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v}분`, '학습시간']} />
              <Legend
                formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                iconSize={10}
              />
            </PieChart>
          </ResponsiveContainer>
        </section>
      ) : (
        <section className="bg-white rounded-xl p-4 shadow-sm text-center text-gray-400 py-10">
          아직 실제 학습시간 기록이 없어요
        </section>
      )}
    </div>
  )
}
