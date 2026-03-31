import { useState } from 'react'
import GradeBadge from './GradeBadge'
import { DOMAIN_LABELS, DOMAIN_COLORS, DOMAIN_ORDER } from '../../data/questions'
import './Page2Detail.css'

export default function Page2Detail({ result }) {
  const { domainScores, domainGrades, domainFeedbacks } = result
  const [openDomain, setOpenDomain] = useState(null)

  function toggle(domain) {
    setOpenDomain(prev => prev === domain ? null : domain)
  }

  return (
    <div className="page2">
      <p className="page2-intro">각 영역을 탭하면 상세 피드백을 확인할 수 있어요.</p>
      {DOMAIN_ORDER.map(domain => {
        const grade = domainGrades[domain]
        const score = domainScores[domain]
        const feedback = domainFeedbacks[domain]
        const color = DOMAIN_COLORS[domain]
        const isOpen = openDomain === domain

        return (
          <div key={domain} className="page2-domain-card">
            <button
              className="page2-domain-header"
              onClick={() => toggle(domain)}
              aria-expanded={isOpen}
            >
              <div className="page2-domain-left">
                <span className="page2-domain-dot" style={{ background: color }} />
                <span className="page2-domain-name">{DOMAIN_LABELS[domain]}</span>
              </div>
              <div className="page2-domain-right">
                <GradeBadge grade={grade} />
                <span className="page2-domain-score">{score}점</span>
                <span className="page2-domain-arrow">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && feedback && (
              <div className="page2-domain-body">
                <div className="page2-score-bar-wrap">
                  <div className="page2-score-bar-track">
                    <div
                      className="page2-score-bar-fill"
                      style={{ width: `${score}%`, background: color }}
                    />
                  </div>
                </div>

                <div className="page2-feedback-row">
                  <div className="page2-feedback-item strength">
                    <span className="page2-feedback-label">💪 강점</span>
                    <p>{feedback.strength}</p>
                  </div>
                  <div className="page2-feedback-item weakness">
                    <span className="page2-feedback-label">🎯 보완</span>
                    <p>{feedback.weakness}</p>
                  </div>
                </div>

                <div className="page2-coaching">
                  <span className="page2-coaching-icon">💬</span>
                  <p>{feedback.coaching}</p>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
