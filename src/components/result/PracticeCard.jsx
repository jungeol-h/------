import './PracticeCard.css'

export default function PracticeCard({ card, index }) {
  const weekLabels = ['이번 주', '다음 주', '그 다음 주']

  return (
    <div className="practice-card">
      <div className="practice-card-week">{weekLabels[index] || `${index + 1}주차`}</div>
      <h4 className="practice-card-title">{card.title}</h4>
      <div className="practice-card-section">
        <div>
          <p className="practice-card-label">핵심 과제</p>
          <p className="practice-card-text">{card.core}</p>
        </div>
      </div>
      <div className="practice-card-section">
        <div>
          <p className="practice-card-label">강화 과제</p>
          <p className="practice-card-text">{card.boost}</p>
        </div>
      </div>
    </div>
  )
}
