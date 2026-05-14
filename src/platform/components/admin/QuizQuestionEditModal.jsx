import { useState } from 'react'
import { X, Save } from 'lucide-react'

export default function QuizQuestionEditModal({ mode = 'create', initial, quizSetId, defaultOrderNo = 1, onSubmit, onClose }) {
  const [orderNo, setOrderNo] = useState(initial?.orderNo ?? defaultOrderNo)
  const [question, setQuestion] = useState(initial?.question ?? '')
  const [acceptedAnswersRaw, setAcceptedAnswersRaw] = useState(
    initial?.acceptedAnswers ? initial.acceptedAnswers.join(', ') : ''
  )
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [hint, setHint] = useState(initial?.hint ?? '')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const isEdit = mode === 'edit'

  const parsedAnswers = acceptedAnswersRaw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)

  const canSubmit =
    question.trim() &&
    parsedAnswers.length > 0 &&
    Number.isFinite(Number(orderNo)) &&
    Number(orderNo) > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    setErrorMsg('')
    try {
      await onSubmit({
        quizSetId,
        orderNo: Number(orderNo),
        question: question.trim(),
        acceptedAnswers: parsedAnswers,
        explanation: explanation.trim(),
        hint: hint.trim(),
      })
      onClose()
    } catch (err) {
      setErrorMsg(err?.message ?? '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-800">{isEdit ? '문제 편집' : '새 문제 추가'}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">문제 번호 *</label>
            <input
              type="number"
              min={1}
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">문제 본문 *</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
              placeholder="문제 내용을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">정답 *</label>
            <textarea
              value={acceptedAnswersRaw}
              onChange={(e) => setAcceptedAnswersRaw(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
              placeholder="여러 정답은 쉼표 또는 줄바꿈으로 구분 (예: 품사, 단어의 갈래)"
            />
            {parsedAnswers.length > 0 && (
              <p className="text-[11px] text-gray-400 mt-1">
                인식된 정답 {parsedAnswers.length}개: {parsedAnswers.join(' · ')}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">해설 (선택)</label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
              placeholder="제출 후 학생에게 보여줄 해설"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">힌트 (선택)</label>
            <input
              type="text"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="학생에게 보여줄 힌트"
            />
          </div>

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
