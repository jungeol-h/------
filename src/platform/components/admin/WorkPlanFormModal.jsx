import { useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import ModalShell from '../common/ModalShell.jsx'
import TimeField from '../common/TimeField.jsx'
import {
  WORK_PLAN_TYPES, WORK_PLAN_TYPE_LABELS,
  WORK_PLAN_AUDIENCES, WORK_PLAN_AUDIENCE_LABELS,
  WORK_PLAN_STATUSES, WORK_PLAN_STATUS_LABELS,
} from '../../data/workRecordTypes.js'

// 업무계획 추가/수정 모달 — 일자/시작~종료 시간/업무내용(중복 체크)/대상(복수)/메모.
// 2026-07-30 개편: 학생을 특정하지 않고 센터장 업무 상황만 기록한다
// (구체적 대상은 메모에). 수정 모드에서 구 기록의 types(COUNSELING_TYPES 값)와
// studentIds는 건드리지 않고 보존한다 — types는 새 목록만 토글, studentIds는
// patch에서 제외해 덮어쓰지 않는다.
// plan이 있으면 수정 모드.
export default function WorkPlanFormModal({ plan, onClose }) {
  const { addWorkPlan, updateWorkPlan } = useData()
  const { currentUser } = useAuth()
  const isEdit = !!plan

  const [planDate, setPlanDate] = useState(plan?.planDate ?? '')
  const [planTime, setPlanTime] = useState(plan?.planTime ?? '')
  const [planEndTime, setPlanEndTime] = useState(plan?.planEndTime ?? '')
  const [types, setTypes] = useState(plan?.types ?? [])
  const [audiences, setAudiences] = useState(plan?.audiences ?? [])
  const [memo, setMemo] = useState(plan?.memo ?? '')
  const [status, setStatus] = useState(plan?.status ?? 'planned')
  const [saving, setSaving] = useState(false)

  const fieldClass = 'w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
  // 'HH:MM' 고정폭 문자열이라 문자열 비교로 충분
  const timeInvalid = !!planTime && !!planEndTime && planEndTime < planTime
  const canSave = !saving && planDate && !timeInvalid

  const toggleType = (type) => {
    setTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  const toggleAudience = (aud) => {
    setAudiences((prev) => (prev.includes(aud) ? prev.filter((a) => a !== aud) : [...prev, aud]))
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      if (isEdit) {
        // studentIds는 보내지 않는다 — 구 기록의 태그를 덮어쓰지 않기 위함
        await updateWorkPlan(plan.id, { planDate, planTime, planEndTime, types, audiences, memo, status })
      } else {
        await addWorkPlan({ authorId: currentUser?.id, planDate, planTime, planEndTime, types, audiences, memo })
      }
      onClose()
    } catch {
      // 저장 실패는 전역 Toast가 표면화한다.
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell title={isEdit ? '업무계획 수정' : '업무계획 추가'} onClose={onClose}>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">일자 (필수)</label>
          <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className={fieldClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">시작 시간 (선택)</label>
            <TimeField value={planTime} onChange={setPlanTime} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">종료 시간 (선택)</label>
            <TimeField value={planEndTime} onChange={setPlanEndTime} className={fieldClass} />
          </div>
        </div>
        {timeInvalid && (
          <p className="text-xs text-red-500 -mt-2">종료 시간이 시작 시간보다 빠릅니다.</p>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">업무내용 (중복 선택 가능)</label>
          <div className="grid grid-cols-2 gap-1.5">
            {WORK_PLAN_TYPES.map((type) => (
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
                {WORK_PLAN_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">대상 (복수 선택 가능)</label>
          <div className="grid grid-cols-2 gap-1.5">
            {WORK_PLAN_AUDIENCES.map((aud) => (
              <label
                key={aud}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition ${
                  audiences.includes(aud)
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={audiences.includes(aud)}
                  onChange={() => toggleAudience(aud)}
                  className="accent-blue-500"
                />
                {WORK_PLAN_AUDIENCE_LABELS[aud]}
              </label>
            ))}
          </div>
        </div>

        {isEdit && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">진행 상황</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={fieldClass}>
              {WORK_PLAN_STATUSES.map((s) => (
                <option key={s} value={s}>{WORK_PLAN_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        )}

        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택 — 구체적 대상이 있으면 여기에)"
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
    </ModalShell>
  )
}
