import { useState } from 'react'
import { X, Save } from 'lucide-react'

const GRADE_OPTIONS = ['중1', '중2', '중3']

export default function QuizSetEditModal({ mode = 'create', initial, onSubmit, onClose }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [grade, setGrade] = useState(initial?.grade ?? '중1')
  const [round, setRound] = useState(initial?.round ?? 1)
  const [source, setSource] = useState(initial?.source ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const isEdit = mode === 'edit'
  const canSubmit = title.trim() && grade && Number.isFinite(Number(round)) && Number(round) > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onSubmit({
        title: title.trim(),
        grade,
        round: Number(round),
        source: source.trim(),
        description: description.trim(),
        isPublished,
      })
      onClose()
    } catch (err) {
      setErrorMsg(err?.message ?? '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800">{isEdit ? '회차 편집' : '새 회차 만들기'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="예: 중1 국어 1단원 확인평가"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">학년 *</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">회차 *</label>
              <input
                type="number"
                min={1}
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">출처 (선택)</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="예: 중1 국어 교재 1단원.pdf"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">설명 (선택)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
              placeholder="회차에 대한 메모"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700">학생에게 배포 (체크 해제 시 학생 화면에 노출되지 않음)</span>
          </label>

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
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
