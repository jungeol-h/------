// 내신 피드백 보고서 입력 폼 — 학생 본인 작성 + 강사 대리 작성 공용.
// 시험 키가 바뀌면 부모가 key prop으로 재마운트한다 (상태 초기화).
// 저장: existing 있으면 update, 없으면 add → DUPLICATE면 refetch 후 기존 행 수정 모드 전환.

import { useState } from 'react'
import { Plus, Save, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { examKeyLabel } from '../../utils/examTerms.js'

const FIXED_SUBJECTS = ['국어', '영어', '수학', '과학', '사회']
const MAX_CUSTOM = 3
const SATISFACTION = ['매우 불만족', '불만족', '보통', '만족', '매우 만족']

const emptyRow = (subject = '', custom = false) => ({
  subject, custom, prevScore: '', targetScore: '', score: '', perfScore: '', perfMax: '',
  satisfaction: null, good: '', improve: '',
})

const toStr = (v) => (v === null || v === undefined ? '' : String(v))

function buildRows(existing) {
  const saved = existing?.subjects ?? []
  const fixed = FIXED_SUBJECTS.map((name) => {
    const s = saved.find((x) => x.subject === name)
    return s ? fromSaved(s, false) : emptyRow(name)
  })
  const custom = saved.filter((s) => !FIXED_SUBJECTS.includes(s.subject)).slice(0, MAX_CUSTOM).map((s) => fromSaved(s, true))
  return [...fixed, ...custom]
}

function fromSaved(s, custom) {
  return {
    subject: s.subject ?? '', custom,
    prevScore: toStr(s.prevScore), targetScore: toStr(s.targetScore), score: toStr(s.score),
    perfScore: toStr(s.perfScore), perfMax: toStr(s.perfMax),
    satisfaction: s.satisfaction ?? null, good: s.good ?? '', improve: s.improve ?? '',
  }
}

const num = (v) => (v === '' ? null : Number(v))

function isEmptyRow(r) {
  return !r.prevScore && !r.targetScore && !r.score && !r.perfScore && !r.perfMax
    && r.satisfaction == null && !r.good.trim() && !r.improve.trim()
}

function validate(rows) {
  for (const r of rows) {
    if (isEmptyRow(r)) continue
    const label = r.subject.trim() || '추가 과목'
    if (r.custom && !r.subject.trim()) return '추가한 과목의 이름을 입력해 주세요.'
    for (const [k, name] of [['prevScore', '지난시험'], ['targetScore', '목표'], ['score', '이번시험']]) {
      if (r[k] === '') continue
      const n = Number(r[k])
      if (Number.isNaN(n) || n < 0 || n > 100) return `${label} ${name} 점수는 0~100 사이로 입력해 주세요.`
    }
    if (r.perfScore !== '' || r.perfMax !== '') {
      const p = Number(r.perfScore)
      const m = Number(r.perfMax)
      if (r.perfScore !== '' && (Number.isNaN(p) || p < 0)) return `${label} 수행평가 점수를 확인해 주세요.`
      if (r.perfMax !== '' && (Number.isNaN(m) || m < 0)) return `${label} 수행평가 만점을 확인해 주세요.`
      if (r.perfScore !== '' && r.perfMax !== '' && p > m) return `${label} 수행평가 취득점수가 만점보다 클 수 없어요.`
    }
  }
  return null
}

function NumInput({ label, value, onChange, disabled, max = 100 }) {
  return (
    <label className="block">
      <span className="block text-[11px] text-gray-500 mb-0.5">{label}</span>
      <input
        type="number" inputMode="decimal" min={0} max={max} step="any"
        value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50"
      />
    </label>
  )
}

export default function ExamFeedbackForm({ student, examKey, existing = null, readOnly = false, onSaved, onCancel }) {
  const { currentUser } = useAuth()
  const { addExamFeedback, updateExamFeedback, refetchExamFeedback } = useData()
  const [current, setCurrent] = useState(existing)
  const [rows, setRows] = useState(() => buildRows(existing))
  const [actionPlan, setActionPlan] = useState(existing?.actionPlan ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const patchRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  const customCount = rows.filter((r) => r.custom).length

  // 기존 보고서가 있으면 그 스냅샷, 없으면 학생 현재 정보
  const school = current?.school || student?.school || ''
  const grade = current?.grade || student?.grade || ''
  const className = current?.className || student?.className || ''

  const applyExisting = (row) => {
    setCurrent(row)
    setRows(buildRows(row))
    setActionPlan(row.actionPlan ?? '')
  }

  const handleSave = async () => {
    const msg = validate(rows)
    if (msg) { setError(msg); return }
    const subjects = rows.filter((r) => !isEmptyRow(r)).map((r) => ({
      subject: r.subject.trim(),
      prevScore: num(r.prevScore), targetScore: num(r.targetScore), score: num(r.score),
      perfScore: num(r.perfScore), perfMax: num(r.perfMax),
      satisfaction: r.satisfaction, good: r.good.trim(), improve: r.improve.trim(),
    }))
    if (subjects.length === 0 && !actionPlan.trim()) { setError('입력된 내용이 없어요.'); return }
    setBusy(true); setError(''); setNotice('')
    const stamp = { updatedBy: currentUser?.id ?? null, updatedByName: currentUser?.name ?? '' }
    try {
      let saved
      if (current) {
        const patch = { subjects, actionPlan: actionPlan.trim(), ...stamp, updatedAt: new Date().toISOString() }
        await updateExamFeedback(current.id, patch)
        saved = { ...current, ...patch }
      } else {
        saved = await addExamFeedback({
          studentId: student.id, ...examKey, school, grade, className,
          writtenDate: todayStr(), subjects, actionPlan: actionPlan.trim(), ...stamp,
        })
      }
      setCurrent(saved?.id ? saved : current)
      setNotice('저장했어요.')
      onSaved?.(saved)
    } catch (err) {
      if (err?.code === 'DUPLICATE') {
        try {
          const row = await refetchExamFeedback(student.id, examKey)
          if (row) { applyExisting(row); setNotice('이미 작성된 보고서가 있어 불러왔어요. 내용을 확인하고 다시 저장해 주세요.'); return }
        } catch { /* 아래 공통 오류 처리 */ }
      }
      setError('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 text-sm">
        <p className="font-bold text-gray-900">{examKeyLabel(examKey)}</p>
        <p className="text-xs text-gray-500 mt-1">
          {[school, [grade, className].filter(Boolean).join(' '), student?.name].filter(Boolean).join(' · ')}
        </p>
        {current && (
          <p className="text-[11px] text-gray-400 mt-1">
            마지막 수정: {current.updatedByName || '-'} · {(current.updatedAt || '').slice(0, 10)}
            {current.writtenDate ? ` (작성일 ${current.writtenDate})` : ''}
          </p>
        )}
      </div>

      <p className="text-xs font-bold text-gray-700 px-1">01 점수 비교와 성적 만족도</p>
      {rows.map((r, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
          <div className="flex items-center gap-2">
            {r.custom ? (
              <input
                value={r.subject} disabled={readOnly} maxLength={20} placeholder="과목명"
                onChange={(e) => patchRow(i, { subject: e.target.value })}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            ) : (
              <span className="flex-1 text-sm font-bold text-gray-900">{r.subject}</span>
            )}
            {r.custom && !readOnly && (
              <button type="button" aria-label="과목 삭제" onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                className="p-1 text-gray-400 hover:text-red-500"><X size={16} /></button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <NumInput label="지난시험" value={r.prevScore} disabled={readOnly} onChange={(v) => patchRow(i, { prevScore: v })} />
            <NumInput label="이번 목표" value={r.targetScore} disabled={readOnly} onChange={(v) => patchRow(i, { targetScore: v })} />
            <NumInput label="이번시험" value={r.score} disabled={readOnly} onChange={(v) => patchRow(i, { score: v })} />
          </div>

          <div>
            <span className="block text-[11px] text-gray-500 mb-0.5">수행평가 (취득 / 만점)</span>
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" min={0} step="any" value={r.perfScore} disabled={readOnly}
                onChange={(e) => patchRow(i, { perfScore: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50" />
              <span className="text-gray-400">/</span>
              <input type="number" inputMode="decimal" min={0} step="any" value={r.perfMax} disabled={readOnly}
                onChange={(e) => patchRow(i, { perfMax: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50" />
            </div>
          </div>

          <div>
            <span className="block text-[11px] text-gray-500 mb-1">
              성적 만족도{r.satisfaction ? ` · ${SATISFACTION[r.satisfaction - 1]}` : ''}
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" disabled={readOnly}
                  onClick={() => patchRow(i, { satisfaction: r.satisfaction === n ? null : n })}
                  className={`h-9 rounded-lg text-sm font-bold border transition-colors ${
                    r.satisfaction === n ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5 px-0.5">
              <span>매우 불만족</span><span>매우 만족</span>
            </div>
          </div>

          <label className="block">
            <span className="block text-[11px] text-gray-500 mb-0.5">잘한 점</span>
            <textarea rows={2} value={r.good} disabled={readOnly} onChange={(e) => patchRow(i, { good: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50" />
          </label>
          <label className="block">
            <span className="block text-[11px] text-gray-500 mb-0.5">개선할 점</span>
            <textarea rows={2} value={r.improve} disabled={readOnly} onChange={(e) => patchRow(i, { improve: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50" />
          </label>
        </div>
      ))}

      {!readOnly && customCount < MAX_CUSTOM && (
        <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow('', true)])}
          className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500">
          <Plus size={14} /> 과목 추가 ({customCount}/{MAX_CUSTOM})
        </button>
      )}

      <p className="text-xs font-bold text-gray-700 px-1 pt-1">02 다음 시험을 위한 핵심 실천과제</p>
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <textarea rows={4} value={actionPlan} disabled={readOnly} onChange={(e) => setActionPlan(e.target.value)}
          placeholder="언제 · 무엇을 · 얼마나 실천할지 적어 보세요."
          className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50" />
      </div>

      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      {notice && <p className="text-xs text-blue-600 px-1">{notice}</p>}

      {!readOnly && (
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600">취소</button>
          )}
          <button type="button" onClick={handleSave} disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-500 text-white text-sm font-bold disabled:opacity-50">
            <Save size={15} /> {busy ? '저장 중…' : current ? '수정 저장' : '저장'}
          </button>
        </div>
      )}
    </div>
  )
}
