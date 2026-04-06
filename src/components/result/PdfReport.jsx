import { DOMAIN_LABELS } from '../../data/questions'

const RADAR_ORDER = ['learningWill', 'efficiency', 'diligence', 'vision', 'environment', 'selfEfficacy']

function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function SvgRadar({ domainScores, finalType, size = 520 }) {
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.32
  const levels = [20, 40, 60, 80, 100]
  const n = RADAR_ORDER.length
  const angles = RADAR_ORDER.map((_, i) => (360 / n) * i)

  const gridPolygons = levels.map(pct => {
    const r = (pct / 100) * maxR
    return RADAR_ORDER.map((_, i) => {
      const p = polarToXY(cx, cy, r, angles[i])
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    }).join(' ')
  })

  const dataPoints = RADAR_ORDER.map((domain, i) => {
    const score = domainScores[domain] || 0
    return polarToXY(cx, cy, (score / 100) * maxR, angles[i])
  })
  const dataPoly = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const labelGap = 42

  // 학습유형 — 공백 기준 2줄 분리
  const typeLines = []
  if (finalType) {
    const mid = Math.ceil(finalType.length / 2)
    const spaceIdx = finalType.indexOf(' ', mid - 4)
    if (spaceIdx > 0 && spaceIdx < finalType.length - 2) {
      typeLines.push(finalType.slice(0, spaceIdx))
      typeLines.push(finalType.slice(spaceIdx + 1))
    } else {
      typeLines.push(finalType)
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible">
      {/* 그리드 */}
      {gridPolygons.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#E9E5F5" strokeWidth="0.8" />
      ))}
      {/* 축선 */}
      {angles.map((a, i) => {
        const end = polarToXY(cx, cy, maxR, a)
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#E9E5F5" strokeWidth="0.8" />
      })}
      {/* 데이터 */}
      <polygon points={dataPoly} fill="#7C3AED" fillOpacity="0.15" stroke="#7C3AED" strokeWidth="2.5" />
      {/* 꼭짓점 */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#7C3AED" stroke="white" strokeWidth="2" />
      ))}
      {/* 라벨 */}
      {RADAR_ORDER.map((domain, i) => {
        const lp = polarToXY(cx, cy, maxR + labelGap, angles[i])
        const score = domainScores[domain] || 0
        return (
          <g key={domain}>
            <text x={lp.x} y={lp.y - 6} textAnchor="middle" fontSize="14" fontWeight="800" fill="#1F2937">
              {DOMAIN_LABELS[domain]}
            </text>
            <text x={lp.x} y={lp.y + 12} textAnchor="middle" fontSize="13" fontWeight="600" fill="#7C3AED">
              {score}점
            </text>
          </g>
        )
      })}
      {/* 중앙 원 + 유형 */}
      <circle cx={cx} cy={cy} r="46" fill="white" fillOpacity="0.9" />
      <circle cx={cx} cy={cy} r="46" fill="none" stroke="#E9E5F5" strokeWidth="1.5" />
      {typeLines.length === 1 ? (
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="12" fontWeight="800" fill="#4C1D95">
          {typeLines[0]}
        </text>
      ) : (
        <>
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#6B7280">
            {typeLines[0]}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="12" fontWeight="800" fill="#4C1D95">
            {typeLines[1]}
          </text>
        </>
      )}
    </svg>
  )
}

// ─── 레이아웃 상수 ───
const PAGE_W = 1122
const PAGE_H = 794
const HEADER_H = 44
const FOOTER_H = 20
const PAD_X = 32
const PAD_Y = 20
const GAP = 20
const CONTENT_H = PAGE_H - HEADER_H - FOOTER_H - PAD_Y * 2
const COL_LEFT = 480
const COL_RIGHT = PAGE_W - PAD_X * 2 - GAP - COL_LEFT

export default function PdfReport({ result, reportRef }) {
  const {
    studentName,
    school,
    grade,
    domainScores,
    finalType,
    overallSummary,
    mindSummary,
    practiceSummary,
    practiceCards,
  } = result

  const today = new Date()
  const dateStr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`

  // 실천과제: 카드별 제목 + 핵심과제만 표시 (PDF 공간 제한)
  const displayTasks = []
  if (practiceCards) {
    practiceCards.forEach(card => {
      if (card?.core) displayTasks.push(card.core)
    })
  }
  const TASK_COUNT = Math.max(displayTasks.length, 3)
  while (displayTasks.length < TASK_COUNT) displayTasks.push('')

  return (
    <div
      ref={reportRef}
      style={{
        width: `${PAGE_W}px`,
        height: `${PAGE_H}px`,
        background: 'white',
        fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* ── 헤더 ── */}
      <div style={{
        height: `${HEADER_H}px`,
        background: '#5B21B6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
      }}>
        <span style={{ color: 'white', fontWeight: 800, fontSize: '15px' }}>
          학습자 사전 진단 검사 결과
        </span>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{dateStr}</span>
      </div>

      {/* ── 본문 ── */}
      <div style={{
        display: 'flex',
        gap: `${GAP}px`,
        padding: `${PAD_Y}px ${PAD_X}px`,
        height: `${CONTENT_H}px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>

        {/* ── 좌측 ── */}
        <div style={{
          width: `${COL_LEFT}px`,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          height: '100%',
          overflow: 'hidden',
        }}>

          {/* 학습자 정보 + 유형 (한 행) */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexShrink: 0,
          }}>
            {/* 정보 */}
            <div style={{
              flex: 1,
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', marginBottom: '8px', letterSpacing: '0.05em' }}>
                학습자 정보
              </div>
              <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#9CA3AF', fontSize: '11px' }}>이름 </span>
                  <span style={{ fontWeight: 800, color: '#111827' }}>{studentName || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#9CA3AF', fontSize: '11px' }}>학교 </span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{school || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#9CA3AF', fontSize: '11px' }}>학년 </span>
                  <span style={{ fontWeight: 600, color: '#374151' }}>{grade || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 학습 유형 */}
          <div style={{
            background: '#5B21B6',
            borderRadius: '8px',
            padding: '14px 18px',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginBottom: '4px' }}>
              나의 학습 유형
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>
              {finalType}
            </div>
          </div>

          {/* 종합 총평 (요약) */}
          <div style={{
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '14px 18px',
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#7C3AED', marginBottom: '10px', letterSpacing: '0.05em' }}>
              종합 총평
            </div>
            <p style={{
              fontSize: '13px',
              color: '#374151',
              lineHeight: 1.8,
              margin: 0,
              wordBreak: 'keep-all',
            }}>
              {overallSummary || ''}
            </p>
          </div>

          {/* 마인드 코칭 + 실천 코칭 (2단) */}
          <div style={{
            display: 'flex',
            gap: '12px',
            flexShrink: 0,
          }}>
            <div style={{
              flex: 1,
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '12px 16px',
              overflow: 'hidden',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#7C3AED', marginBottom: '6px', letterSpacing: '0.05em' }}>
                마인드 코칭
              </div>
              <p style={{
                fontSize: '11.5px',
                color: '#374151',
                lineHeight: 1.7,
                margin: 0,
                wordBreak: 'keep-all',
              }}>
                {mindSummary || ''}
              </p>
            </div>
            <div style={{
              flex: 1,
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '12px 16px',
              overflow: 'hidden',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#7C3AED', marginBottom: '6px', letterSpacing: '0.05em' }}>
                실천 코칭
              </div>
              <p style={{
                fontSize: '11.5px',
                color: '#374151',
                lineHeight: 1.7,
                margin: 0,
                wordBreak: 'keep-all',
              }}>
                {practiceSummary || ''}
              </p>
            </div>
          </div>

          {/* 실천 과제 */}
          <div style={{
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '14px 18px',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#7C3AED', marginBottom: '10px', letterSpacing: '0.05em' }}>
              실천 과제
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayTasks.map((task, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  height: '28px',
                  borderBottom: i < TASK_COUNT - 1 ? '1px solid #F3F4F6' : 'none',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: '13px',
                    height: '13px',
                    border: '1.5px solid #D1D5DB',
                    borderRadius: '3px',
                    flexShrink: 0,
                    background: 'white',
                  }} />
                  <span style={{
                    fontSize: '11.5px',
                    color: task ? '#374151' : '#D1D5DB',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                  }}>
                    {task || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 우측: 레이더 차트 ── */}
        <div style={{
          width: `${COL_RIGHT}px`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          overflow: 'visible',
        }}>
          <SvgRadar domainScores={domainScores} finalType={finalType} size={Math.min(CONTENT_H, COL_RIGHT) - 20} />
        </div>
      </div>

      {/* ── 푸터 ── */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${FOOTER_H}px`,
        background: '#5B21B6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 32px',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px' }}>
          by gooooookee.
        </span>
      </div>
    </div>
  )
}
