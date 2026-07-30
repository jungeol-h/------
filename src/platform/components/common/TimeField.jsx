// 시간 입력 필드 — 네이티브 <input type="time"> 대체 (utils/timeInput.js 참고).
// 네이티브는 로케일에 따라 12시간제로 떠서 키보드로 오전/오후를 못 치고
// "20"이 "02"로 잘리는 문제가 있었다 (2026-07-30 클라이언트 리포트).
//
// value: 'HH:MM' 또는 '' (빈 값 허용 — 선택 입력 필드용).
// onChange(next): 정규화된 'HH:MM' 문자열 또는 ''를 받는다 (이벤트 아님 주의).
// 편집 중에만 draft를 쓰고(포커스 시 스냅샷), blur/Enter 시점에 파싱·정규화한다.
// 해석 불가 입력은 draft를 버려 마지막 유효 값으로 되돌아간다.

import { useState } from 'react'
import { parseTimeInput, TIME_INPUT_HINT } from '../../utils/timeInput.js'

export default function TimeField({
  value = '',
  onChange,
  className = '',
  placeholder = TIME_INPUT_HINT,
  ...rest
}) {
  const [draft, setDraft] = useState(null) // null = 편집 중 아님 → value 표시

  const commit = (raw) => {
    setDraft(null)
    const s = String(raw).trim()
    if (!s) {
      if (value !== '') onChange('')
      return
    }
    const parsed = parseTimeInput(s)
    if (parsed && parsed !== value) onChange(parsed)
  }

  return (
    <input
      type="text"
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setDraft(value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  )
}
