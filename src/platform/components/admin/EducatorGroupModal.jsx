import { useState } from 'react'
import { Save } from 'lucide-react'
import ModalShell from '../common/ModalShell.jsx'
import { GROUP_OPTIONS } from '../../data/groups.js'

// 교육자 소속 그룹 편집 (admin 전용) — 직원은 복수 소속이 가능해 체크박스로 고른다.
// 아무것도 선택하지 않으면 무소속 = 전체 열람이 된다 (admin과 동일한 시야).
export default function EducatorGroupModal({ educator, onSave, onClose }) {
  const [selected, setSelected] = useState(() => new Set(educator.groups ?? []))
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const toggle = (g) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })

  const handleSave = async () => {
    setErrorMsg('')
    setSaving(true)
    try {
      // GROUP_OPTIONS 순서로 저장해 표시 순서를 일정하게 유지한다
      await onSave(GROUP_OPTIONS.filter((g) => selected.has(g)))
      onClose()
    } catch {
      setErrorMsg('저장 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`${educator.name} 소속 그룹`} onClose={onClose}>
      <p className="text-xs text-gray-500 -mt-2">
        소속 그룹의 학생·기록만 보입니다. 아무것도 선택하지 않으면 전체를 볼 수 있어요.
      </p>

      <div className="space-y-2">
        {GROUP_OPTIONS.map((g) => (
          <label
            key={g}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer select-none ${
              selected.has(g)
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 text-gray-600'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(g)}
              onChange={() => toggle(g)}
              className="w-4 h-4 accent-emerald-600"
            />
            {g}
          </label>
        ))}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
          {errorMsg}
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
          disabled={saving}
          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={16} />
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </ModalShell>
  )
}
