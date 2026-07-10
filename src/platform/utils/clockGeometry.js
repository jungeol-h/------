// 24시간 원형 타임테이블(부채꼴) 좌표 계산 — 순수함수.
// 자정(0분)이 12시 방향, 시계 방향으로 하루가 돈다. SVG 좌표계 기준.

// 하루 중 분(0~1440) → 각도(도). 자정=위쪽(-90°) 기준 시계 방향.
export function minutesToAngle(min) {
  return (min / 1440) * 360 - 90
}

// 'HH:MM' → 하루 중 분. 잘못된 값은 null.
export function hhmmToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

// 중심(cx,cy)·반지름 r·각도(도) → 원주 위 좌표
export function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

// 부채꼴 path (startMin~endMin 구간). 자정을 넘는 계획은 endMin이 startMin보다
// 작아지므로 +1440 보정한다. 0분 구간은 null.
export function sectorPath(cx, cy, r, startMin, endMin) {
  let end = endMin
  if (end < startMin) end += 1440
  if (end === startMin) return null
  // 하루를 꽉 채우면 arc가 무너지므로 살짝 줄인다
  if (end - startMin >= 1440) end = startMin + 1439.9

  const startAngle = minutesToAngle(startMin)
  const endAngle = minutesToAngle(end)
  const p0 = polar(cx, cy, r, startAngle)
  const p1 = polar(cx, cy, r, endAngle)
  const largeArc = end - startMin > 720 ? 1 : 0

  return `M ${cx} ${cy} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`
}
