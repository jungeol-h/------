import { useMemo, useState } from 'react'
import { X, Save } from 'lucide-react'
import { isActiveStudent } from '../../data/studentStatus.js'

// 점수전용(외부시험) 회차의 학생별 점수 입력 그리드.
// 저장은 변경된 행만 순차 upsert — 실패한 행은 남겨 재시도 가능하게 한다.
export default function QuizScoreEntryModal({ quizSet, students, attempts, onUpsertScore, onClose }) {
  const targets = useMemo(
    () => students
      .filter((s) => isActiveStudent(s) && (quizSet.grade === '전체' || s.grade === quizSet.grade))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'ko')),
    [students, quizSet.grade]
  )
  const attemptByStudent = useMemo(
    () => new Map(attempts.map((a) => [a.studentId, a])),
    [attempts]
  )

  // 입력 초안: studentId → 문자열 (빈 문자열 = 미입력 유지)
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const setDraft = (studentId) => (e) =>
    setDrafts((prev) => ({ ...prev, [studentId]: e.target.value }))

  // 변경된 행: 초안이 있고, 기존 점수와 다르고, 0..만점 범위인 것
  const changed = targets.filter((s) => {
    const raw = drafts[s.id]
    if (raw === undefined || raw === '') return false
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > quizSet.maxScore) return false
    return n !== attemptByStudent.get(s.id)?.score
  })

  const invalid = targets.some((s) => {
    const raw = drafts[s.id]
    if (raw === undefined || raw === '') return false
    const n = Number(raw)
    return !Number.isFinite(n) || n < 0 || n > quizSet.maxScore
  })

  const handleSave = async () => {
    if (saving || changed.length === 0) return
    setSaving(true)
    setErrorMsg('')
    let failed = 0
    for (const s of changed) {
      try {
        await onUpsertScore(s.id, quizSet.id, Number(drafts[s.id]))
        setDrafts((prev) => {
          const next = { ...prev }
          delete next[s.id]
          return next
        })
      } catch {
        failed += 1
      }
    }
    setSaving(false)
    if (failed > 0) setErrorMsg(`${failed}명 저장에 실패했습니다. 입력값이 남아 있으니 다시 저장해 주세요.`)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-gray-800">점수 입력 — {quizSet.title}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {quizSet.grade} · {quizSet.round}회 · 만점 {quizSet.maxScore}점
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-1.5">
          {targets.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">{quizSet.grade} 재원 학생이 없습니다.</p>
          )}
          {targets.map((s) => {
            const attempt = attemptByStudent.get(s.id)
            return (
              <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm font-semibold text-gray-800 flex-1">{s.name}</span>
                <span className="text-[11px] text-gray-400 w-16 text-right">
                  {attempt ? `${attempt.score}점` : '미입력'}
                </span>
                <input
                  type="number"
                  min={0}
                  max={quizSet.maxScore}
                  value={drafts[s.id] ?? ''}
                  onChange={setDraft(s.id)}
                  placeholder={attempt ? String(attempt.score) : '-'}
                  className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-right"
                />
              </div>
            )
          })}
          {errorMsg && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700"
          >
            닫기
          </button>
          <button
            onClick={handleSave}
            disabled={saving || changed.length === 0 || invalid}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? '저장 중…' : `저장 (${changed.length}명)`}
          </button>
        </div>
      </div>
    </div>
  )
}
