import {
  COUNSELING_FIELDS, COUNSELING_FIELD_LABELS, hasStructuredContent,
} from '../../data/counselingTypes.js'

// 상담 기록 카드 본문 — 내부/외부/학부모 카드에서 공용.
// 4필드(주제/세부내용/후속조치/특이사항) 구조 기록은 라벨 붙여 표시하고,
// 구 기록(단일 content)은 fallback 텍스트를 그대로 보여준다.
export default function CounselingRecordBody({ record, fallback, className = 'text-sm text-gray-600' }) {
  if (!hasStructuredContent(record)) {
    return <p className={`${className} whitespace-pre-wrap`}>{fallback}</p>
  }
  return (
    <div className="space-y-1.5">
      {COUNSELING_FIELDS.map((key) => {
        const value = record[key]?.trim()
        if (!value) return null
        return (
          <div key={key} className="flex gap-2">
            <span className="text-xs font-semibold text-gray-400 w-14 shrink-0 pt-0.5">
              {COUNSELING_FIELD_LABELS[key]}
            </span>
            <p className={`${className} whitespace-pre-wrap flex-1`}>{value}</p>
          </div>
        )
      })}
    </div>
  )
}
