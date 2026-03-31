import PracticeCard from './PracticeCard'
import './Page3Coaching.css'

export default function Page3Coaching({ result }) {
  const { mindCoaching, practiceCoaching, practiceCards } = result

  return (
    <div className="page3">
      <div className="page3-mind-section">
        <h3 className="page3-section-title">🧠 마인드 코칭</h3>
        <div className="page3-coaching-box">
          <p>{mindCoaching}</p>
        </div>
      </div>

      <div className="page3-practice-section">
        <h3 className="page3-section-title">🔧 실천 코칭</h3>
        <div className="page3-coaching-box">
          <p>{practiceCoaching}</p>
        </div>
      </div>

      <div className="page3-cards-section">
        <h3 className="page3-section-title">📋 주간 실천 카드</h3>
        <p className="page3-cards-desc">
          지금 가장 필요한 영역부터 차근차근 실천해 보세요.
        </p>
        <div className="page3-cards-list">
          {practiceCards.map((card, idx) => (
            <PracticeCard key={idx} card={card} index={idx} />
          ))}
        </div>
      </div>
    </div>
  )
}
