import { DOMAIN_LABELS, DOMAIN_COLORS } from '../../data/questions'
import './QuestionCard.css'

export default function QuestionCard({ question }) {
  const domainLabel = DOMAIN_LABELS[question.domain]
  const domainColor = DOMAIN_COLORS[question.domain]

  return (
    <div className="question-card">
      <div className="question-domain" style={{ color: domainColor, borderColor: domainColor + '33', background: domainColor + '15' }}>
        {domainLabel}
      </div>
      <p className="question-text">{question.text}</p>
    </div>
  )
}
