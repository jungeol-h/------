import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import { TOTAL_QUESTIONS } from '../data/questions'
import ProgressBar from '../components/survey/ProgressBar'
import QuestionCard from '../components/survey/QuestionCard'
import LikertScale from '../components/survey/LikertScale'
import './SurveyPage.css'

export default function SurveyPage() {
  const { state, dispatch } = useDiagnosis()
  const navigate = useNavigate()
  const { currentIndex, answers, isCompleted, shuffledQuestions } = state
  const autoMoveTimer = useRef(null)

  useEffect(() => {
    if (isCompleted) {
      navigate('/result')
    }
  }, [isCompleted, navigate])

  function handleSelect(value) {
    dispatch({ type: 'SET_ANSWER', index: currentIndex, value })

    clearTimeout(autoMoveTimer.current)
    autoMoveTimer.current = setTimeout(() => {
      dispatch({ type: 'NEXT_QUESTION' })
    }, 300)
  }

  function handlePrev() {
    clearTimeout(autoMoveTimer.current)
    dispatch({ type: 'PREV_QUESTION' })
  }

  if (currentIndex >= TOTAL_QUESTIONS) return null

  const question = shuffledQuestions[currentIndex]
  const selected = answers[currentIndex]

  return (
    <div className="survey-page">
      <div className="survey-header">
        <button
          className="survey-back-btn"
          onClick={currentIndex === 0 ? () => navigate('/pre-survey') : handlePrev}
          aria-label="이전"
        >
          ←
        </button>
        <ProgressBar current={currentIndex + 1} total={TOTAL_QUESTIONS} />
      </div>

      <div className="survey-question-num">
        질문 {currentIndex + 1}
      </div>

      <div className="survey-card-wrap">
        <QuestionCard question={question} showDomain={false} />
      </div>

      <div className="survey-scale-wrap">
        <LikertScale selected={selected} onSelect={handleSelect} />
      </div>

      <div className="survey-hint">
        선택하면 자동으로 다음 문항으로 이동합니다
      </div>
    </div>
  )
}
