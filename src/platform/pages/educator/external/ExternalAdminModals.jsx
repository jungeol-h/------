// 외생 상담 프로그램의 관리자 전용 모달 2종 — 프로그램 추가(ProgramFormModal)와
// 학생 일괄 등록(StudentImportModal: 붙여넣은 텍스트를 parseStudentLines로 파싱 → 미리보기 → bulkInsert).
// ExternalCounselingTab에서 admin 역할에게만 노출된다.

import { useMemo, useState } from 'react'
import { X, CheckCheck } from 'lucide-react'
import { createProgram, bulkInsertStudents, parseStudentLines } from './externalData.js'

const fieldClass =
  'w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

// ── 프로그램 추가 모달 ───────────────────────────────────────
export function ProgramFormModal({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const yearNum = year.trim() ? Number(year) : null
      const created = await createProgram({
        name: name.trim(),
        year: Number.isFinite(yearNum) ? yearNum : null,
      })
      onSaved?.(created)
      onClose()
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">프로그램 추가</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="프로그램 이름 (예: 2026 안동 진로진학 외부상담)"
          className={fieldClass}
        />
        <input
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="연도 (예: 2026)"
          inputMode="numeric"
          className={fieldClass}
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
            disabled={saving || !name.trim()}
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

// ── 학생 일괄 등록 모달 ─────────────────────────────────────
export function StudentImportModal({ programId, onClose, onSaved }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const preview = useMemo(() => parseStudentLines(text), [text])

  const handleSave = async () => {
    if (preview.length === 0) return
    setSaving(true)
    try {
      const created = await bulkInsertStudents(programId, preview)
      onSaved?.(created)
      onClose()
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4 pb-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">학생 일괄 등록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          한 줄에 한 명씩. <span className="font-mono">이름[탭 또는 쉼표]학교[탭 또는 쉼표]학년</span>
          <br />
          엑셀에서 셀 범위를 복사해 붙여넣으면 탭으로 자동 구분됩니다.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'홍길동\t안동중\t중2\n김철수, 풍산중, 중3'}
          rows={6}
          className="w-full border border-gray-200 rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        {preview.length > 0 && (
          <div className="rounded-xl border border-gray-100 max-h-40 overflow-y-auto">
            <div className="text-xs font-semibold text-gray-500 px-3 py-2 bg-gray-50">
              미리보기 {preview.length}명
            </div>
            <div className="divide-y divide-gray-100">
              {preview.map((e, i) => (
                <div key={i} className="px-3 py-1.5 text-xs text-gray-700 flex gap-2">
                  <span className="font-semibold">{e.name}</span>
                  <span className="text-gray-400">{e.school || '-'}</span>
                  <span className="text-gray-400">{e.grade || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving || preview.length === 0}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={16} />
            {preview.length}명 등록
          </button>
        </div>
      </div>
    </div>
  )
}
