export function todayFileDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function nowDateTime(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

export function sanitizeFilenamePart(part) {
  return String(part).replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

export function buildFilename(reportName, identifier) {
  const parts = ['나르샤', reportName, identifier, todayFileDate()]
    .filter(Boolean)
    .map(sanitizeFilenamePart)
  return `${parts.join('_')}.pdf`
}

export function formatPercent(value, fractionDigits = 0) {
  if (value == null || Number.isNaN(value)) return '-'
  return `${Number(value).toFixed(fractionDigits)}%`
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '-'
  return Number(value).toLocaleString('ko-KR')
}
