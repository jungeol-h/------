import './GradeBadge.css'

const GRADE_LABELS = {
  A: '최상',
  B: '상',
  C: '중',
  D: '하',
  E: '최하',
}

export default function GradeBadge({ grade }) {
  return (
    <span className={`grade-badge grade-${grade}`}>
      {grade}
      <span className="grade-label">{GRADE_LABELS[grade]}</span>
    </span>
  )
}
