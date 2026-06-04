import { useState, useEffect, useRef } from 'react'
import {
  CalendarDays, Check, ChevronDown, ChevronUp, Clock, GripVertical, Pause, Play, Plus,
  RotateCcw, Save, Trash2,
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
import {
  addMonths,
  buildReorderUpdates,
  dateStripDays,
  formatMinutes,
  monthDays,
  nextSortOrder as getNextSortOrder,
  plansForDate,
  todayPlansFor,
  todaySubjectBreakdown,
} from './learningTabLogic.js'

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

function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

function monthLabel(dateStr) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(`${dateStr}T00:00:00`))
}

function dayNumber(dateStr) {
  return String(new Date(`${dateStr}T00:00:00`).getDate())
}

function weekdayLabel(dateStr) {
  return new Intl.DateTimeFormat('ko-KR', { weekday: 'narrow' }).format(new Date(`${dateStr}T00:00:00`))
}

function formatPlanDate(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`)
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

function TimePresetControl({ label, value, onChange, onCommit }) {
  const activeValue = Number(value || 0)

  const handleStep = (delta) => {
    const next = Math.max(0, activeValue + delta)
    const nextValue = next > 0 ? String(next) : ''
    onChange(nextValue)
    onCommit(nextValue)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-gray-500">목표 시간</span>
        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
          activeValue > 0
            ? 'bg-blue-600 text-white border border-blue-600'
            : 'bg-gray-100 border border-gray-200 text-gray-400'
        }`}>
          {activeValue > 0 ? formatMinutes(activeValue) : label}
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

function PlanStatusBadge({ plan }) {
  const actual = actualMinutes(plan)
  if (plan.status === 'done') {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold whitespace-nowrap">
        완료
      </span>
    )
  }
  if (actual > 0) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold whitespace-nowrap">
        진행중
      </span>
    )
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-bold whitespace-nowrap">
      대기
    </span>
  )
}

function PlanTab({ studentId, records }) {
  const { addLearningPlan, updateLearningRecord, reorderLearningPlans, deleteLearningRecord } = useData()
  const today = toDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const visibleDates = dateStripDays(selectedDate)
  const selectedPlans = plansForDate(records, studentId, selectedDate)
  const isPastDate = selectedDate < today
  const modeLabel = selectedDate === today ? '오늘' : isPastDate ? '과거' : '미래'
  const [drafts, setDrafts] = useState({})
  const [editValues, setEditValues] = useState({})
  const [draftKeys, setDraftKeys] = useState([])
  const [openRowKey, setOpenRowKey] = useState(null)
  const [deletingKey, setDeletingKey] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(today)
  const [reorderMode, setReorderMode] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const draftSeqRef = useRef(0)

  const rows = [
    ...selectedPlans.map((record) => ({ key: record.id, record })),
    ...(!isPastDate ? draftKeys.map((key) => ({ key, draft: drafts[key] ?? EMPTY_PLAN })) : []),
  ]

  useEffect(() => {
    setDrafts({})
    setEditValues({})
    setDraftKeys([])
    setOpenRowKey(null)
    setReorderMode(false)
  }, [selectedDate])

  const updateDraft = (key, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? EMPTY_PLAN), ...patch },
    }))
  }

  const updateEditValue = (key, patch) => {
    setEditValues((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), ...patch },
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

  const saveRow = async (row) => {
    if (isPastDate) return null
    const value = {
      subject: rowValue(row, 'subject'),
      studyMethod: rowValue(row, 'studyMethod'),
      content: rowValue(row, 'content'),
      plannedMin: rowValue(row, 'plannedMin'),
    }
    if (!value.subject) return null
    const payload = {
      subject: value.subject,
      studyMethod: value.studyMethod,
      content: value.content?.trim() ?? '',
      plannedMin: value.plannedMin ? Number(value.plannedMin) : null,
    }
    try {
      if (row.record) {
        await updateLearningRecord(row.record.id, payload)
        setEditValues((prev) => ({ ...prev, [row.key]: {} }))
        return row.record.id
      }
      const record = await addLearningPlan(studentId, {
        date: selectedDate,
        ...payload,
        sortOrder: getNextSortOrder(selectedPlans),
      })
      setDrafts((prev) => ({ ...prev, [row.key]: EMPTY_PLAN }))
      setEditValues((prev) => ({ ...prev, [row.key]: {} }))
      setDraftKeys((prev) => prev.filter((draftKey) => draftKey !== row.key))
      setOpenRowKey(record.id)
      return record.id
    } catch {
      return null
    }
  }

  const handleCellChange = async (row, field, value) => {
    if (isPastDate) return
    updateEditValue(row.key, { [field]: value })
    if (!row.record) updateDraft(row.key, { [field]: value })
  }

  const updateFieldValue = (row, field, value) => {
    if (isPastDate) return
    updateEditValue(row.key, { [field]: value })
    if (!row.record) updateDraft(row.key, { [field]: value })
  }

  const requestDelete = async (row) => {
    if (isPastDate) return
    if (!row.record) {
      setDrafts((prev) => ({ ...prev, [row.key]: EMPTY_PLAN }))
      setEditValues((prev) => ({ ...prev, [row.key]: {} }))
      setDraftKeys((prev) => prev.filter((draftKey) => draftKey !== row.key))
      setOpenRowKey(null)
      return
    }
    if (deletingKey) return
    setDeletingKey(row.key)
    try {
      await deleteLearningRecord(row.record.id)
      setOpenRowKey((current) => (current === row.key ? null : current))
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setDeletingKey(null)
    }
  }

  const handleDropPlan = async (targetId) => {
    if (!draggingId || draggingId === targetId || isPastDate) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }
    const updates = buildReorderUpdates(selectedPlans, draggingId, targetId)
    setDraggingId(null)
    setDragOverId(null)
    if (updates.length === 0) return
    try {
      await reorderLearningPlans(updates)
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">학습 계획</h2>
          <p className="text-xs text-gray-500 mt-0.5">{formatPlanDate(selectedDate)} · {modeLabel}</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDatePicker((open) => !open)}
            className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-gray-500 flex items-center justify-center shadow-sm"
            aria-label="날짜 직접 선택"
          >
            <CalendarDays size={17} />
          </button>
          {showDatePicker && (
            <div className="absolute right-0 top-11 z-20 w-72 rounded-xl bg-white border border-gray-100 shadow-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCalendarMonth((date) => addMonths(date, -1))}
                  className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 text-lg font-bold"
                  aria-label="이전 달"
                >
                  ‹
                </button>
                <p className="text-sm font-bold text-gray-800">{monthLabel(calendarMonth)}</p>
                <button
                  type="button"
                  onClick={() => setCalendarMonth((date) => addMonths(date, 1))}
                  className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 text-lg font-bold"
                  aria-label="다음 달"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                  <div key={day} className="h-6 flex items-center justify-center text-[11px] font-bold text-gray-400">
                    {day}
                  </div>
                ))}
                {monthDays(calendarMonth).map((date) => {
                  const selected = date === selectedDate
                  const isToday = date === today
                  const inMonth = date.slice(0, 7) === calendarMonth.slice(0, 7)
                  const hasPlan = plansForDate(records, studentId, date).length > 0
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => {
                        setSelectedDate(date)
                        setCalendarMonth(date)
                        setShowDatePicker(false)
                      }}
                      className={`h-8 rounded-lg text-xs font-bold relative ${
                        selected
                          ? 'bg-blue-600 text-white'
                          : isToday
                            ? 'bg-blue-50 text-blue-700'
                            : inMonth
                              ? 'text-gray-700 hover:bg-gray-100'
                              : 'text-gray-300'
                      }`}
                    >
                      {dayNumber(date)}
                      {hasPlan && (
                        <span className={`absolute left-1/2 -translate-x-1/2 bottom-0.5 w-1 h-1 rounded-full ${
                          selected ? 'bg-white' : 'bg-blue-500'
                        }`} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-1 items-end">
          {visibleDates.map((date) => {
            const selected = date === selectedDate
            const isToday = date === today
            const plans = plansForDate(records, studentId, date)
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`h-14 rounded-lg text-center text-xs font-bold relative transition-colors ${
                  selected
                    ? 'bg-blue-600 text-white'
                    : isToday
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-gray-50 text-gray-600'
                }`}
              >
                <span className="block text-[10px] opacity-70">{weekdayLabel(date)}</span>
                <span className={`block ${selected ? 'text-lg' : 'text-sm'}`}>{dayNumber(date)}</span>
                {plans.length > 0 && (
                  <span className={`absolute left-1/2 -translate-x-1/2 bottom-1 w-1 h-1 rounded-full ${
                    selected ? 'bg-white' : 'bg-blue-500'
                  }`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-5 text-center">
            <p className="text-sm font-semibold text-gray-500">
              {isPastDate ? '이 날짜의 계획 기록이 없습니다.' : '이 날짜의 계획이 아직 없습니다.'}
            </p>
          </div>
        )}

        {rows.map((row, index) => {
          const planNumber = index + 1
          const actual = row.record ? actualMinutes(row.record) : 0
          const subject = rowValue(row, 'subject')
          const studyMethod = rowValue(row, 'studyMethod')
          const content = rowValue(row, 'content')
          const plannedMin = rowValue(row, 'plannedMin')
          const isOpen = openRowKey === row.key
          const planned = Number(plannedMin || 0)
          const progress = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0
          const canDrag = Boolean(row.record) && !isPastDate && reorderMode
          const isDragging = draggingId === row.record?.id
          const isDragTarget = dragOverId === row.record?.id && draggingId !== row.record?.id
          const isEmptyDraft = !row.record && !subject

          return (
            <div
              key={row.key}
              onDragOver={(event) => {
                if (!canDrag || !draggingId) return
                event.preventDefault()
                setDragOverId(row.record.id)
              }}
              onDrop={(event) => {
                if (!canDrag) return
                event.preventDefault()
                handleDropPlan(row.record.id)
              }}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                isEmptyDraft
                  ? 'border-amber-300 ring-2 ring-amber-100'
                  : isDragTarget
                    ? 'border-blue-300 ring-2 ring-blue-100'
                    : 'border-gray-100'
              } ${isDragging ? 'opacity-60' : ''}`}
            >
              <div className="p-3">
                <div className={`flex items-start ${reorderMode ? 'gap-1.5' : 'gap-3'}`}>
                  {reorderMode && (
                    <button
                      type="button"
                      draggable={canDrag}
                      onDragStart={(event) => {
                        if (!canDrag) return
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', row.record.id)
                        setDraggingId(row.record.id)
                        setDragOverId(row.record.id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setDragOverId(null)
                      }}
                      disabled={!canDrag}
                      className="w-4 h-8 rounded-md text-gray-300 hover:text-gray-500 flex items-center justify-center cursor-grab active:cursor-grabbing flex-shrink-0 disabled:cursor-default disabled:opacity-40"
                      aria-label="계획 순서 변경"
                    >
                      <GripVertical size={14} />
                    </button>
                  )}
                  <div className="w-10 flex-shrink-0 flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOpenRowKey(isOpen ? null : row.key)}
                      className="w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold bg-gray-50 border-gray-200 text-gray-500"
                      aria-label={isOpen ? '편집 닫기' : '편집 열기'}
                    >
                      {planNumber}
                    </button>
                    {row.record && <PlanStatusBadge plan={row.record} />}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenRowKey(isOpen ? null : row.key)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-sm font-bold ${subject ? 'text-gray-900' : 'text-gray-400'}`}>
                        {subject || `${planNumber}번째 계획`}
                      </span>
                      {studyMethod && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                          {studyMethod}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {content || (isPastDate ? '기록된 학습 내용이 없습니다' : '카드를 눌러 과목, 학습법, 내용을 채우세요')}
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-blue-600">학습 {formatMinutes(actual)}</span>
                        <span className="text-gray-500">목표 {plannedMin ? formatMinutes(plannedMin) : '미입력'}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
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
                  {isPastDate ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white border border-gray-200 p-3">
                          <p className="text-[11px] font-bold text-gray-500">과목</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">{subject || '-'}</p>
                        </div>
                        <div className="rounded-lg bg-white border border-gray-200 p-3">
                          <p className="text-[11px] font-bold text-gray-500">학습법</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">{studyMethod || '-'}</p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 p-3">
                        <p className="text-[11px] font-bold text-gray-500">학습 내용</p>
                        <p className="text-sm text-gray-800 mt-1">{content || '-'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white border border-gray-200 p-3">
                          <p className="text-[11px] font-bold text-gray-500">목표 시간</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">{plannedMin ? formatMinutes(plannedMin) : '-'}</p>
                        </div>
                        <div className="rounded-lg bg-white border border-gray-200 p-3">
                          <p className="text-[11px] font-bold text-gray-500">실제 학습</p>
                          <p className="text-sm font-bold text-blue-600 mt-1">{actual > 0 ? formatMinutes(actual) : '-'}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
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
                      onChange={(e) => updateFieldValue(row, 'content', e.target.value)}
                      placeholder="교재, 단원, 문제 수, 암기량"
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-blue-400"
                    />
                  </label>

                  <TimePresetControl
                    label="미입력"
                    value={plannedMin}
                    onChange={(value) => updateFieldValue(row, 'plannedMin', value)}
                    onCommit={(value) => updateFieldValue(row, 'plannedMin', value)}
                  />

                  <div className="flex justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => requestDelete(row)}
                      disabled={deletingKey === row.key}
                      className="h-10 px-4 rounded-lg bg-white border border-red-100 text-red-600 text-sm font-bold disabled:bg-gray-100 disabled:text-gray-300 active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => saveRow(row)}
                      disabled={!subject}
                      className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Save size={14} />
                      저장
                    </button>
                  </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {!isPastDate && draftKeys.length === 0 && (
          <button
            type="button"
            onClick={() => {
              draftSeqRef.current += 1
              const key = `draft-${Date.now()}-${draftSeqRef.current}`
              setDraftKeys((prev) => [...prev, key])
              setReorderMode(false)
              setOpenRowKey(key)
            }}
            className="w-full h-12 rounded-xl border-2 border-dashed border-gray-200 bg-white text-gray-500 text-sm font-bold flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-600 active:scale-[0.99]"
          >
            <Plus size={16} />
            계획 추가
          </button>
        )}
        {!isPastDate && selectedPlans.length > 1 && draftKeys.length === 0 && (
          <button
            type="button"
            onClick={() => {
              setReorderMode((active) => !active)
              setDraggingId(null)
              setDragOverId(null)
            }}
            className={`w-full h-10 rounded-xl border text-sm font-bold active:scale-[0.99] ${
              reorderMode
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-200 text-gray-500'
            }`}
          >
            {reorderMode ? '순서 바꾸기 완료' : '순서 바꾸기'}
          </button>
        )}
      </div>
    </section>
  )
}

function StudyPlanCard({
  plan,
  index,
  selected,
  running,
  elapsed,
  saved,
  canSave,
  onSelect,
  onToggleTimer,
  onSave,
  onReset,
  onComplete,
}) {
  const actual = actualMinutes(plan)
  const planned = Number(plan.plannedMin || 0)
  const progress = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0

  return (
    <div
      className={`w-full text-left bg-white rounded-xl border p-3 shadow-sm active:scale-[0.99] ${
        selected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 flex-shrink-0 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onSelect(plan.id)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
              plan.status === 'done' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}
            aria-label="타이머 계획 선택"
          >
            {plan.status === 'done' ? <Check size={15} strokeWidth={3} /> : index + 1}
          </button>
          <PlanStatusBadge plan={plan} />
        </div>
        <button
          type="button"
          onClick={() => onSelect(plan.id)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-gray-900">{plan.subject}</span>
            {plan.studyMethod && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                {plan.studyMethod}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {plan.content || '학습 내용 없음'}
          </p>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-blue-600">학습 {formatMinutes(actual)}</span>
              <span className="text-gray-500">목표 {planned > 0 ? formatMinutes(planned) : '미입력'}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600"
                style={{ width: `${progress}%` }}
              />
            </div>
            {selected && elapsed > 0 && (
              <p className="text-[11px] font-bold text-emerald-600">진행 {formatTime(elapsed)}</p>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onComplete(plan)}
          className="h-9 px-3 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center"
        >
          완료
        </button>
      </div>
      {selected && (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-[11px] font-bold text-gray-500">현재 기록</span>
            <span className="font-mono text-lg font-bold text-gray-900">{formatTime(elapsed)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onToggleTimer}
              className={`flex-1 h-11 rounded-lg text-sm font-bold active:scale-95 flex items-center justify-center gap-1.5 ${
                running ? 'bg-amber-300 text-amber-950' : 'bg-blue-600 text-white'
              }`}
            >
              {running ? <><Pause size={16} /> 일시정지</> : elapsed > 0 ? <><Play size={16} /> 재개</> : <><Play size={16} /> 공부 시작</>}
            </button>
            {canSave && (
              <button
                type="button"
                onClick={onSave}
                className="flex-1 h-11 rounded-lg bg-emerald-600 text-white text-sm font-bold active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Save size={15} />
                {saved ? '저장됨' : '누적 저장'}
              </button>
            )}
            {elapsed > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="w-11 h-11 rounded-lg bg-gray-100 text-gray-600 active:scale-95 flex items-center justify-center"
                aria-label="타이머 초기화"
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CompletionWarningModal({ warning, onCancel, onConfirm }) {
  if (!warning) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-5">
        <h3 className="text-base font-bold text-gray-900">목표 시간보다 적게 기록됐습니다</h3>
        <p className="text-sm text-gray-600 mt-2">
          예상 {formatMinutes(warning.planned)} 중 실제 {formatMinutes(warning.actual)}이 기록되어 있습니다.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg bg-gray-100 text-gray-600 text-sm font-bold"
          >
            돌아가기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-lg bg-blue-600 text-white text-sm font-bold"
          >
            그래도 완료
          </button>
        </div>
      </div>
    </div>
  )
}

function SubjectRatioBar({ records }) {
  const today = toDateStr(new Date())
  const breakdown = todaySubjectBreakdown(records, today, 5)
  const total = breakdown.reduce((sum, item) => sum + item.minutes, 0)

  if (total <= 0) return null

  return (
    <section className="bg-white rounded-xl p-3 shadow-sm space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-600">오늘 과목별 학습시간</h3>
        <span className="text-[11px] font-bold text-gray-400">{formatMinutes(total)}</span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
        {breakdown.map((item, index) => (
          <div
            key={item.name}
            className="h-full"
            style={{
              width: `${(item.minutes / total) * 100}%`,
              backgroundColor: SUBJECT_COLORS[SUBJECTS.indexOf(item.name) >= 0 ? SUBJECTS.indexOf(item.name) : index % SUBJECT_COLORS.length],
            }}
          />
        ))}
      </div>
      <div className="flex gap-x-3 gap-y-1 flex-wrap">
        {breakdown.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: SUBJECT_COLORS[SUBJECTS.indexOf(item.name) >= 0 ? SUBJECTS.indexOf(item.name) : index % SUBJECT_COLORS.length],
              }}
            />
            <span className="text-[11px] font-semibold text-gray-600">{item.name}</span>
            <span className="text-[11px] text-gray-400">{formatMinutes(item.minutes)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function StudyTab({ records, todayPlans }) {
  const { updateLearningRecord, completeLearningPlan } = useData()
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [saved, setSaved] = useState(false)
  const [completionWarning, setCompletionWarning] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const selectedPlan = todayPlans.find((plan) => plan.id === selectedPlanId) ?? null

  const selectTimerPlan = (planId) => {
    if (running) return
    const nextPlanId = selectedPlanId === planId ? null : planId
    setSelectedPlanId(nextPlanId)
    setElapsed(0)
    setSaved(false)
  }

  const handleTimerSave = async () => {
    if (elapsed < 10 || !selectedPlan) return
    const minutes = Math.max(1, Math.round(elapsed / 60))
    try {
      await updateLearningRecord(selectedPlan.id, {
        actualDuration: actualMinutes(selectedPlan) + minutes,
      })
      setElapsed(0)
      setRunning(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    }
  }

  const completePlan = async (plan) => {
    try {
      await completeLearningPlan(plan.id)
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    }
  }

  const requestComplete = async (plan) => {
    const planned = Number(plan.plannedMin || 0)
    const actual = actualMinutes(plan)
    if (planned > 0 && actual < planned) {
      setCompletionWarning({ plan, planned, actual })
      return
    }
    await completePlan(plan)
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">학습 타이머</h2>
          <Clock size={20} className="text-gray-400" />
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="text-5xl font-mono font-bold tracking-widest text-center my-4">
            {formatTime(elapsed)}
          </div>
          <div className="text-center min-h-5">
            <span className="text-sm font-bold text-white/90">
              {selectedPlan
                ? `${selectedPlan.subject} · 누적 ${formatMinutes(actualMinutes(selectedPlan))}`
                : '아래 계획을 눌러 공부를 시작하세요'}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">오늘 공부할 계획</h2>
        {todayPlans.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-5 text-center">
            <p className="text-sm font-semibold text-gray-500">오늘 계획이 아직 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayPlans.map((plan, index) => (
              <StudyPlanCard
                key={plan.id}
                plan={plan}
                index={index}
                selected={plan.id === selectedPlanId}
                running={running && plan.id === selectedPlanId}
                elapsed={plan.id === selectedPlanId ? elapsed : 0}
                saved={saved && plan.id === selectedPlanId}
                canSave={elapsed >= 10 && plan.id === selectedPlanId}
                onSelect={selectTimerPlan}
                onToggleTimer={() => setRunning((current) => !current)}
                onSave={handleTimerSave}
                onReset={() => {
                  setElapsed(0)
                  setRunning(false)
                }}
                onComplete={requestComplete}
              />
            ))}
          </div>
        )}
      </section>

      <SubjectRatioBar records={records} />

      <CompletionWarningModal
        warning={completionWarning}
        onCancel={() => setCompletionWarning(null)}
        onConfirm={async () => {
          const plan = completionWarning.plan
          setCompletionWarning(null)
          await completePlan(plan)
        }}
      />
    </div>
  )
}

function StatsTab({ records }) {
  const today = toDateStr(new Date())
  const timeRecords = records.filter((r) => actualMinutes(r) > 0)
  const todayTimeRecords = timeRecords.filter((r) => r.date === today)
  const totalMinutes = timeRecords.reduce((sum, r) => sum + actualMinutes(r), 0)
  const todayMinutes = todayTimeRecords.reduce((sum, r) => sum + actualMinutes(r), 0)
  const completedPlans = records.filter((r) => r.recordType === 'planner' && r.status === 'done').length
  const plannedMinutes = records
    .filter((r) => r.recordType === 'planner')
    .reduce((sum, r) => sum + Number(r.plannedMin || 0), 0)
  const actualRate = plannedMinutes > 0 ? Math.round((totalMinutes / plannedMinutes) * 100) : null
  const pieData = subjectBreakdown(timeRecords, SUBJECTS.length).map(({ name, minutes }) => ({
    name,
    value: minutes,
  }))

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">오늘 학습시간</p>
          <p className="text-2xl font-bold text-blue-600">{formatMinutes(todayMinutes)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">전체 학습시간</p>
          <p className="text-2xl font-bold text-emerald-600">{formatMinutes(totalMinutes)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">완료 계획</p>
          <p className="text-2xl font-bold text-indigo-600">{completedPlans}<span className="text-sm font-normal text-gray-500">개</span></p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500">계획 대비 실행</p>
          <p className="text-2xl font-bold text-amber-600">{actualRate ?? '-'}<span className="text-sm font-normal text-gray-500">{actualRate == null ? '' : '%'}</span></p>
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
              <Tooltip formatter={(v) => [formatMinutes(v), '학습시간']} />
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

export default function LearningTab() {
  const { currentUser } = useAuth()
  const { data } = useData()
  const [activeTab, setActiveTab] = useState('plan')

  const records = data.learningRecords.filter((r) => r.studentId === currentUser?.id)
  const todayPlans = todayPlansFor(data.learningRecords, currentUser?.id)

  return (
    <div className="py-6 space-y-5">
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('plan')}
          className={`h-11 rounded-lg text-sm font-bold transition-colors ${
            activeTab === 'plan' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          계획하기
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('study')}
          className={`h-11 rounded-lg text-sm font-bold transition-colors ${
            activeTab === 'study' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          공부하기
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`h-11 rounded-lg text-sm font-bold transition-colors ${
            activeTab === 'stats' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          돌아보기
        </button>
      </div>

      <div className={activeTab === 'plan' ? 'block' : 'hidden'}>
        <PlanTab studentId={currentUser?.id} records={data.learningRecords} />
      </div>
      <div className={activeTab === 'study' ? 'block' : 'hidden'}>
        <StudyTab records={records} todayPlans={todayPlans} />
      </div>
      <div className={activeTab === 'stats' ? 'block' : 'hidden'}>
        <StatsTab records={records} />
      </div>
    </div>
  )
}
