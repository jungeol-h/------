import './QuestionCard.css'

export default function QuestionCard({ question, showDomain = false }) {
  return (
    <div className="question-card">
      <p className="question-text">{question.text}</p>
    </div>
  )
}
