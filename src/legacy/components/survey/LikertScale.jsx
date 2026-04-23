import { LIKERT_LABELS } from '../../data/questions'
import './LikertScale.css'

export default function LikertScale({ selected, onSelect }) {
  return (
    <div className="likert-wrap">
      <div className="likert-labels">
        <span>전혀 아니다</span>
        <span>매우 그렇다</span>
      </div>
      <div className="likert-buttons">
        {[1, 2, 3, 4, 5].map(value => (
          <button
            key={value}
            className={`likert-btn ${selected === value ? 'selected' : ''}`}
            onClick={() => onSelect(value)}
            aria-label={LIKERT_LABELS[value - 1]}
          >
            <span className="likert-number">{value}</span>
            <span className="likert-label">{LIKERT_LABELS[value - 1]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
