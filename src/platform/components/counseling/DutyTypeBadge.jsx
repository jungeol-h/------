import { EDUCATOR_DUTIES, dutyOfType, hasMultipleDuties } from '../../data/educatorDuties.js'

// 복수 담당업무 교직원(educatorDuties)의 상담유형 오작성 방지 배지 — 선택한 유형이
// 어느 업무 보고서로 나가는지 작성 시점에 보여준다 (예: 황광희 국어/진로진학컨설팅).
// 단일 담당 교직원이거나 유형 미선택이면 아무것도 그리지 않는다.
export default function DutyTypeBadge({ educatorId, type }) {
  if (!hasMultipleDuties(educatorId) || !type) return null
  const duty = dutyOfType(educatorId, type)
  if (duty) {
    return (
      <p className="text-xs font-semibold text-blue-600 mt-1">
        「{duty.label}」 업무 기록 — {duty.label} 보고서에 포함됩니다
      </p>
    )
  }
  const labels = EDUCATOR_DUTIES[educatorId].map((d) => d.label).join('·')
  return (
    <p className="text-xs font-semibold text-amber-600 mt-1">
      {labels} 보고서에 포함되지 않는 유형입니다
    </p>
  )
}
