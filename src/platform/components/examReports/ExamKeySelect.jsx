import { useMemo } from 'react'
import { examKeyLabel, examKeyOptions, sameExamKey } from '../../utils/examTerms.js'

const encode = (k) => `${k.examYear}-${k.semester}-${k.examType}`
const decode = (s) => {
  const [examYear, semester, examType] = s.split('-')
  return { examYear: Number(examYear), semester: Number(semester), examType }
}

// 내신 시험 키(학년도·학기·중간/기말) 선택 — 내신백서 전반 공용.
// value가 최근 선택지 밖(과거 기록)이면 선택지에 덧붙여 보여준다.
// allowAll: '전체 시험' 항목(value=null) 허용 — 목록 필터용.
export default function ExamKeySelect({ value, onChange, allowAll = false, count = 6, className = '' }) {
  const options = useMemo(() => {
    const base = examKeyOptions(undefined, count)
    if (value && !base.some((o) => sameExamKey(o, value))) base.push(value)
    return base
  }, [value, count])

  return (
    <select
      value={value ? encode(value) : ''}
      onChange={(e) => onChange(e.target.value ? decode(e.target.value) : null)}
      className={`border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
    >
      {allowAll && <option value="">전체 시험</option>}
      {options.map((o) => (
        <option key={encode(o)} value={encode(o)}>{examKeyLabel(o)}</option>
      ))}
    </select>
  )
}
