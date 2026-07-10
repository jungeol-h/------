import { useState } from 'react'
import { X, CheckCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import StudentCombobox from '../counseling/StudentCombobox.jsx'
import { COUNSELING_TYPES, COUNSELING_TYPE_LABELS } from '../../data/counselingTypes.js'

// 업무계획 추가/수정 모달 — 일시/업무내용(유형 중복 체크)/대상 학생(복수)/메모.
// plan이 있으면 수정 모드.
export default function WorkPlanFormModal({ students = [], plan, onClose }) {
  const { addWorkPlan, updateWorkPlan } = useData()
  const { currentUser } = useAuth()
  const isEdit = !!plan

  const [planDate, setPlanDate] = useState(plan?.planDate ?? '')
  const [planTime, setPlanTime] = useState(plan?.planTime ?? '')
  const [types, setTypes] = useState(plan?.types ?? [])
  const [studentIds, setStudentIds] = useState(plan?.studentIds ?? [])
  const [memo, setMemo] = useState(plan?.memo ?? '')
  const [saving, setSaving] = useState(false)

  const fieldClass = 'w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
  const canSave = !saving && planDate

  const toggleType = (type) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  const addStudent = (id) => {
    if (!id) return
    setStudentIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const removeStudent = (id) => {
    setStudentIds((prev) => prev.filter((sid) => sid !== id))
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      if (isEdit) {
        await updateWorkPlan(plan.id, { planDate, planTime, types, studentIds, memo })
      } else {
        await addWorkPlan({ authorId: currentUser?.id, planDate, planTime, types, studentIds, memo })
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
      <div className="bg-white rounded-3xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">{isEdit ? '업무계획 수정' : '업무계획 추가'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">일자 (필수)</label>
            <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">시간 (선택)</label>
            <input type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)} className={fieldClass} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">업무내용 (중복 선택 가능)</label>
          <div className="grid grid-cols-2 gap-1.5">
            {COUNSELING_TYPES.map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition ${
                  types.includes(type)
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={types.includes(type)}
                  onChange={() => toggleType(type)}
                  className="accent-blue-500"
                />
                {COUNSELING_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">대상 학생 (복수 선택 가능)</label>
          <StudentCombobox students={students} value="" onChange={addStudent} placeholder="학생 검색해서 추가..." />
          {studentIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {studentIds.map((sid) => {
                const s = students.find((st) => st.id === sid)
                return (
                  <span key={sid} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full pl-2.5 pr-1 py-1">
                    {s?.name ?? sid}
                    <button type="button" onClick={() => removeStudent(sid)} className="p-0.5 hover:text-blue-900" aria-label="학생 제거">
                      <X size={12} />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={3}
          className={`${fieldClass} resize-none`}
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 font-medium">
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={16} />
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
