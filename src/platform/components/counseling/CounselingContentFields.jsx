import { COUNSELING_FIELD_LABELS } from '../../data/counselingTypes.js'

// 상담 내용 6단계 입력 그룹 — 작성 폼 3곳(내부 인라인/내부 모달/외부 모달) 공용.
// value: { topic, diagnosis, advice, followUp, note, nextAppointment }, onChange(next)로 통째로 갱신.
// 상담주제·다음상담예약은 한 줄 입력, 나머지는 textarea.
const TEXTAREA_ROWS = { diagnosis: 3, advice: 3, followUp: 2, note: 2 }

export default function CounselingContentFields({ value, onChange, fieldClass }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value })
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">{COUNSELING_FIELD_LABELS.topic}</label>
        <input
          type="text"
          value={value.topic}
          onChange={set('topic')}
          placeholder="상담 주제를 입력하세요"
          className={`${fieldClass} w-full`}
        />
      </div>
      {Object.keys(TEXTAREA_ROWS).map((key) => (
        <div key={key}>
          <label className="text-xs text-gray-500 mb-1 block">{COUNSELING_FIELD_LABELS[key]}</label>
          <textarea
            value={value[key]}
            onChange={set(key)}
            rows={TEXTAREA_ROWS[key]}
            className={`${fieldClass} w-full resize-y`}
          />
        </div>
      ))}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">{COUNSELING_FIELD_LABELS.nextAppointment}</label>
        <input
          type="text"
          value={value.nextAppointment}
          onChange={set('nextAppointment')}
          placeholder="예: 7/24(금) 15:00"
          className={`${fieldClass} w-full`}
        />
      </div>
    </div>
  )
}
