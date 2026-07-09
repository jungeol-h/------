import { useState } from 'react'
import { X, CheckCheck } from 'lucide-react'
import { COUNSELING_TYPES, COUNSELING_TYPE_LABELS } from '../../../data/counselingTypes.js'
import { createRecord, updateRecord } from './externalData.js'

// 외생 상담 기록 작성/수정 모달. CounselingFormModal 스타일 차용.
// record가 있으면 수정 모드. 저장 성공 시 onSaved(record)로 로컬 state 갱신.
export default function ExternalCounselingForm({ student, record, counselorId, onClose, onSaved }) {
  const isEdit = !!record
  const [type, setType] = useState(record?.type ?? 'career')
  const [content, setContent] = useState(record?.content ?? '')
  const [saving, setSaving] = useState(false)

  const fieldClass =
    'w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isEdit) {
        await updateRecord(record.id, { content, type })
        onSaved?.({ ...record, content, type })
      } else {
        const created = await createRecord({
          programStudentId: student.id,
          counselorId,
          content,
          type,
        })
        onSaved?.(created)
      }
      onClose()
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">
            {isEdit ? '상담 수정' : '상담 작성'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">
          {student?.name ?? '학생'} 학생
        </div>

        <select value={type} onChange={(e) => setType(e.target.value)} className={fieldClass}>
          {COUNSELING_TYPES.map((t) => (
            <option key={t} value={t}>
              {COUNSELING_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="상담 내용을 입력하세요..."
          rows={4}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={16} />
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
