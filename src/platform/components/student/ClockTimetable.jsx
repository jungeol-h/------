import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { minutesToAngle, hhmmToMinutes, polar, sectorPath } from '../../utils/clockGeometry.js'
import { subjectColor } from '../../data/subjects.js'

const SIZE = 240
const CX = SIZE / 2
const CY = SIZE / 2
const R = 100        // 부채꼴 반지름
const TICK_R = 104   // 눈금 시작
const LABEL_R = 114  // 숫자 라벨

// 오늘의 학습계획표 — 24시간 원형 다이얼에 계획을 부채꼴로 그린다.
// 시작 시각이 있는 계획만 다이얼에 올라가고, 없는 계획은 하단 칩으로 표시.
// plans: 오늘 planner 레코드 배열 (startTime 'HH:MM' | null, plannedMin, subject, status)
export default function ClockTimetable({ plans = [], onGoPlan }) {
  // 현재 시각 바늘 — 1분마다 갱신
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const timed = plans
    .map((p) => {
      const start = hhmmToMinutes(p.startTime)
      if (start == null) return null
      const duration = Math.max(p.plannedMin ?? 0, 15) // 최소 15분 폭으로 보이게
      return { ...p, start, end: start + duration }
    })
    .filter(Boolean)
  const untimed = plans.filter((p) => hhmmToMinutes(p.startTime) == null)

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const needle = polar(CX, CY, R, minutesToAngle(nowMin))

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <CalendarClock size={15} className="text-blue-600" />
          <h3 className="text-sm font-bold text-gray-700">오늘의 학습계획표</h3>
        </div>
        {plans.length > 0 && (
          <span className="text-[11px] text-gray-400">계획 {plans.length}개</span>
        )}
      </div>

      <div className="flex justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="오늘의 학습계획표">
          {/* 다이얼 배경 */}
          <circle cx={CX} cy={CY} r={R} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />

          {/* 계획 부채꼴 */}
          {timed.map((p) => {
            const path = sectorPath(CX, CY, R, p.start, p.end)
            if (!path) return null
            const done = p.status === 'done'
            return (
              <path
                key={p.id}
                d={path}
                fill={subjectColor(p.subject)}
                opacity={done ? 0.35 : 0.75}
                stroke="#ffffff"
                strokeWidth="1"
              />
            )
          })}

          {/* 3시간 간격 눈금 + 숫자 */}
          {Array.from({ length: 8 }, (_, i) => i * 3).map((hour) => {
            const angle = minutesToAngle(hour * 60)
            const t0 = polar(CX, CY, TICK_R - 4, angle)
            const t1 = polar(CX, CY, TICK_R, angle)
            const label = polar(CX, CY, LABEL_R, angle)
            return (
              <g key={hour}>
                <line x1={t0.x} y1={t0.y} x2={t1.x} y2={t1.y} stroke="#94a3b8" strokeWidth="1.5" />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="bold"
                >
                  {hour}
                </text>
              </g>
            )
          })}

          {/* 현재 시각 바늘 */}
          <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          <circle cx={CX} cy={CY} r="3.5" fill="#ef4444" />
        </svg>
      </div>

      {/* 범례 — 다이얼에 올라간 계획 */}
      {timed.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
          {timed.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 text-[11px] text-gray-600">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: subjectColor(p.subject) }} />
              {p.startTime} {p.subject}
              {p.status === 'done' && <span className="text-emerald-600 font-bold">✓</span>}
            </span>
          ))}
        </div>
      )}

      {/* 시간 미지정 계획 칩 */}
      {untimed.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-50">
          <p className="text-[10px] text-gray-400 mb-1">시간 미지정 계획 — 학습 탭에서 시작 시각을 정하면 시계에 표시돼요</p>
          <div className="flex flex-wrap gap-1.5">
            {untimed.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-100"
              >
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: subjectColor(p.subject) }} />
                {p.subject}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 계획 없음 */}
      {plans.length === 0 && (
        <div className="text-center mt-1">
          <p className="text-sm text-gray-400">오늘 세운 계획이 아직 없어요</p>
          {onGoPlan && (
            <button
              type="button"
              onClick={onGoPlan}
              className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              학습 탭에서 계획 세우기 →
            </button>
          )}
        </div>
      )}

      {/* 오늘 날짜 + 현재 시각 */}
      <p className="text-center text-xs text-gray-400 mt-3">
        {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        {' · '}
        {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}
