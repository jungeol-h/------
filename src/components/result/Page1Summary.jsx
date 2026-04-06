import RadarChartView from './RadarChartView'
import { DOMAIN_LABELS, DOMAIN_COLORS } from '../../data/questions'
import './Page1Summary.css'

export default function Page1Summary({ result }) {
  const { finalType, domainScores, strengthDomains, weakDomains, supplements, studentName, overallComment } = result

  return (
    <div className="page1">
      {studentName && (
        <p className="page1-greeting">{studentName}님의 학습 진단 결과</p>
      )}

      <div className="page1-type-card">
        <p className="page1-type-label">나의 학습 유형</p>
        <h2 className="page1-type-name">{finalType}</h2>
      </div>

      <RadarChartView domainScores={domainScores} />

      <div className="page1-domain-scores">
        {Object.entries(domainScores).map(([domain, score]) => (
          <div key={domain} className="page1-score-row">
            <span
              className="page1-score-dot"
              style={{ background: DOMAIN_COLORS[domain] }}
            />
            <span className="page1-score-domain">{DOMAIN_LABELS[domain]}</span>
            <div className="page1-score-bar-track">
              <div
                className="page1-score-bar-fill"
                style={{ width: `${score}%`, background: DOMAIN_COLORS[domain] }}
              />
            </div>
            <span className="page1-score-num">{score}</span>
          </div>
        ))}
      </div>

      {(strengthDomains.length > 0 || weakDomains.length > 0) && (
        <div className="page1-summary-row">
          <div className="page1-summary-box strength">
            <p className="page1-summary-title">핵심 강점</p>
            {strengthDomains.length > 0
              ? strengthDomains.map(d => (
                  <span
                    key={d}
                    className="page1-summary-tag"
                    style={{ background: 'var(--color-primary-mid)', color: 'var(--color-primary)' }}
                  >
                    {DOMAIN_LABELS[d]}
                  </span>
                ))
              : <span className="page1-summary-all">전 영역 균형</span>
            }
          </div>
          <div className="page1-summary-box weak">
            <p className="page1-summary-title">보완 포인트</p>
            {supplements && supplements.length > 0
              ? supplements.map(s => (
                  <span
                    key={s.domain}
                    className="page1-summary-tag"
                    style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-600)' }}
                  >
                    {s.formatted}
                  </span>
                ))
              : <span className="page1-summary-all">전 영역 우수</span>
            }
          </div>
        </div>
      )}
      {strengthDomains.length === 0 && weakDomains.length === 0 && (
        <div className="page1-all-excellent">
          <span className="page1-all-icon">🏆</span>
          <p>모든 영역이 고르게 우수합니다!</p>
        </div>
      )}

      <div className="page1-overall">
        <h3 className="page1-overall-title">종합 총평</h3>
        <p className="page1-overall-text">{overallComment}</p>
      </div>
    </div>
  )
}
