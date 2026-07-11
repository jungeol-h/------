import { useMemo, useState } from 'react'
import { CalendarDays, Plus, Pencil, Trash2 } from 'lucide-react'
import { useData } from '../../context/DataContext.jsx'
import { toDateStr } from '../../context/selectors/weeklyLearning.js'
import { COUNSELING_TYPE_LABELS } from '../../data/counselingTypes.js'
import {
  WORK_PLAN_STATUSES, WORK_PLAN_STATUS_LABELS, WORK_PLAN_STATUS_BADGE,
} from '../../data/workRecordTypes.js'
import WorkPlanFormModal from '../../components/admin/WorkPlanFormModal.jsx'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

// 'YYYY-MM-DD' → 'MM.DD (요일)'
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const day = DAY_NAMES[new Date(y, m - 1, d).getDay()]
  return `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${day})`
}

// 시간 오름차순(미지정 뒤로) 비교
function byTime(a, b) {
  if (!a.planTime && !b.planTime) return 0
  if (!a.planTime) return 1
  if (!b.planTime) return -1
  return a.planTime.localeCompare(b.planTime)
}

// 업무계획 — 오늘/예정/업무별 진행 상황 그룹 리스트 + 추가/수정/삭제.
// 업무기록 탭의 첫 메뉴. readOnly=true(viewer)면 편집 UI 전체를 숨긴다.
export default function WorkPlanTab({ readOnly = false }) {
  const { data, deleteWorkPlan, updateWorkPlan } = useData()
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)

  const activeStudents = useMemo(
    () => data.students.filter((s) => (s.status ?? 'active') === 'active'),
    [data.students]
  )

  const groups = useMemo(() => {
    const todayStr = toDateStr(new Date())
    const today = []
    const upcoming = []
    const past = []
    data.workPlans.forEach((p) => {
      if (p.planDate === todayStr) today.push(p)
      else if (p.planDate > todayStr) upcoming.push(p)
      else past.push(p)
    })
    today.sort(byTime)
    upcoming.sort((a, b) => a.planDate.localeCompare(b.planDate) || byTime(a, b))
    past.sort((a, b) => b.planDate.localeCompare(a.planDate) || byTime(a, b))
    return { today, upcoming, past: past.slice(0, 30) }
  }, [data.workPlans])

  const studentName = (sid) => data.students.find((s) => s.id === sid)?.name ?? '?'

  const handleDelete = async (plan) => {
    if (!window.confirm('이 업무계획을 삭제할까요?')) return
    try {
      await deleteWorkPlan(plan.id)
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  // 예정 → 진행중 → 완료 → 예정 순환
  const cycleStatus = async (plan) => {
    const idx = WORK_PLAN_STATUSES.indexOf(plan.status ?? 'planned')
    const next = WORK_PLAN_STATUSES[(idx + 1) % WORK_PLAN_STATUSES.length]
    try {
      await updateWorkPlan(plan.id, { status: next })
    } catch {
      // 실패는 전역 Toast가 표면화한다.
    }
  }

  const renderStatusBadge = (plan) => {
    const status = plan.status ?? 'planned'
    const cls = WORK_PLAN_STATUS_BADGE[status] ?? WORK_PLAN_STATUS_BADGE.planned
    if (readOnly) {
      return (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>
          {WORK_PLAN_STATUS_LABELS[status]}
        </span>
      )
    }
    return (
      <button
        type="button"
        onClick={() => cycleStatus(plan)}
        title="누르면 진행 상황이 바뀝니다"
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full active:scale-95 transition ${cls}`}
      >
        {WORK_PLAN_STATUS_LABELS[status]}
      </button>
    )
  }

  const renderPlan = (plan) => (
    <li key={plan.id} className="bg-white rounded-2xl shadow-sm p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-800">
              {formatDate(plan.planDate)}{plan.planTime && ` ${plan.planTime}`}
            </span>
            {renderStatusBadge(plan)}
            {plan.types.map((t) => (
              <span key={t} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {COUNSELING_TYPE_LABELS[t] ?? t}
              </span>
            ))}
          </div>
          {plan.studentIds.length > 0 && (
            <p className="text-xs text-gray-600 mt-1 truncate">
              {plan.studentIds.map(studentName).join(', ')}
            </p>
          )}
          {plan.memo && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{plan.memo}</p>}
        </div>
        {!readOnly && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setEditingPlan(plan); setShowForm(true) }}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
              aria-label="수정"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(plan)}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
              aria-label="삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </li>
  )

  const renderGroup = (title, plans, emptyText) => (
    <section>
      <h3 className="text-sm font-bold text-gray-500 mb-2">{title}</h3>
      {plans.length === 0 ? (
        <p className="text-xs text-gray-400 bg-white rounded-2xl shadow-sm p-4 text-center">{emptyText}</p>
      ) : (
        <ul className="space-y-2">{plans.map(renderPlan)}</ul>
      )}
    </section>
  )

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">업무계획</h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">상담·코칭·과제 등 예약 일정을 관리합니다.</p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => { setEditingPlan(null); setShowForm(true) }}
            className="flex items-center gap-1 bg-blue-500 text-white text-sm font-bold rounded-xl px-3 py-2 hover:bg-blue-600 active:scale-95 transition"
          >
            <Plus size={16} />
            일정 추가
          </button>
        )}
      </div>

      {renderGroup('오늘', groups.today, '오늘 예정된 업무가 없습니다.')}
      {renderGroup('예정', groups.upcoming, '예정된 업무가 없습니다.')}
      {renderGroup('업무별 진행 상황', groups.past, '지난 업무가 없습니다.')}

      {showForm && (
        <WorkPlanFormModal
          students={activeStudents}
          plan={editingPlan}
          onClose={() => { setShowForm(false); setEditingPlan(null) }}
        />
      )}
    </div>
  )
}
