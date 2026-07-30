// 시간 입력 파서 — 키보드로 치는 다양한 표기를 'HH:MM' 24시간제 문자열로 정규화.
//
// 배경(2026-07-30 클라이언트): 네이티브 <input type="time">는 로케일에 따라
// 12시간제 UI로 떠서 키보드로는 오전/오후를 지정할 수 없고, "13"·"20"을 치면
// "02" 등으로 잘려 들어갔다. 그래서 자유 텍스트 입력 + 파서로 교체한다
// (components/common/TimeField.jsx가 이 파서를 쓴다).
//
// 허용 표기 (모두 대소문자 무관):
//   "9" → 09:00        "930" → 09:30      "1330" → 13:30
//   "13" → 13:00       "13:30" / "13.30" / "13 30" → 13:30
//   "오후 1" / "pm 1" / "1 pm" → 13:00    "오전 12" → 00:00   "오후 12" → 12:00
//   "13시" → 13:00     "1시30분" → 01:30
// 해석 불가하면 null.

const MERIDIEM_RE = /오전|오후|am|pm|a\.m\.?|p\.m\.?/gi

export function parseTimeInput(raw) {
  let s = String(raw ?? '').trim().toLowerCase()
  if (!s) return null

  let meridiem = null
  if (/오후|p\.?m\.?/.test(s)) meridiem = 'pm'
  else if (/오전|a\.?m\.?/.test(s)) meridiem = 'am'
  s = s.replace(MERIDIEM_RE, ' ')

  // '13시30분' 표기와 구분자(./공백)를 ':'로 통일
  s = s.replace(/시/g, ':').replace(/분/g, '').replace(/[.\s]+/g, ':')
  s = s.replace(/^:+|:+$/g, '')
  if (!s || /[^0-9:]/.test(s)) return null

  let h
  let m
  if (s.includes(':')) {
    const parts = s.split(':').filter(Boolean)
    if (parts.length < 1 || parts.length > 2) return null
    h = Number(parts[0])
    m = parts.length === 2 ? Number(parts[1]) : 0
    if (parts[0].length > 2 || (parts[1] ?? '').length > 2) return null
  } else {
    // 숫자만: 1~2자리 = 시, 3자리 = H+MM, 4자리 = HH+MM
    if (s.length <= 2) { h = Number(s); m = 0 }
    else if (s.length === 3) { h = Number(s.slice(0, 1)); m = Number(s.slice(1)) }
    else if (s.length === 4) { h = Number(s.slice(0, 2)); m = Number(s.slice(2)) }
    else return null
  }

  if (!Number.isInteger(h) || !Number.isInteger(m) || m < 0 || m > 59) return null

  if (meridiem) {
    if (h < 0 || h > 12) return null
    if (meridiem === 'pm') h = h === 12 ? 12 : h + 12
    else h = h === 12 ? 0 : h
  } else if (h < 0 || h > 23) {
    return null
  }

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const TIME_INPUT_HINT = '예: 1430, 오후 2:30'
