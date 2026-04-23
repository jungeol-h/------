import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import { useAdminConfig } from '../context/AdminConfigContext'
import { questions, LIKERT_LABELS, TOTAL_QUESTIONS } from '../data/questions'
import { buildResult } from '../utils/scoreCalculator'
import './SurveyPage.css'

const QUESTIONS_PER_PAGE = 3
const TOTAL_PAGES = Math.ceil(TOTAL_QUESTIONS / QUESTIONS_PER_PAGE)

export default function SurveyPage() {
  const { state, dispatch } = useDiagnosis()
  const { config } = useAdminConfig()
  const navigate = useNavigate()
  const [page, setPage] = useState(0) // 0-indexed
  const [answers, setAnswers] = useState(() => state.answers || new Array(TOTAL_QUESTIONS).fill(0))
  const [isFadingOut, setIsFadingOut] = useState(false)

  // 현재 페이지에 해당하는 문항 인덱스들
  const startIdx = page * QUESTIONS_PER_PAGE
  const pageQuestions = questions.slice(startIdx, startIdx + QUESTIONS_PER_PAGE)

  function handleSelect(globalIdx, value) {
    if (isFadingOut) return

    const nextAnswers = [...answers]
    nextAnswers[globalIdx] = value
    setAnswers(nextAnswers)

    // 이 페이지의 문항들이 모두 답변되었는지 확인
    const isPageComplete = pageQuestions.every((_, i) => nextAnswers[startIdx + i] !== 0)

    // 마지막 페이지가 아닐 때만 자동 넘어감
    if (isPageComplete && page < TOTAL_PAGES - 1) {
      setIsFadingOut(true)
      setTimeout(() => {
        proceedToNext(nextAnswers)
      }, 500)
    }
  }

  function proceedToNext(currentAnswers) {
    if (page < TOTAL_PAGES - 1) {
      dispatch({ type: 'SET_ANSWERS', payload: currentAnswers })
      setPage(p => p + 1)
      setIsFadingOut(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      const result = buildResult(currentAnswers, state.studentName, state.shuffledQuestions, config)
      dispatch({ type: 'SET_SURVEY_RESULT', payload: { answers: currentAnswers, result } })
      navigate('/result')
    }
  }

  function handlePrev() {
    dispatch({ type: 'SET_ANSWERS', payload: answers })
    if (page > 0) {
      setPage(p => p - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      navigate('/pre-survey')
    }
  }

  const answeredCount = answers.filter(a => a !== 0).length
  const progressPercent = Math.round((answeredCount / TOTAL_QUESTIONS) * 100)

  return (
    <div className="survey-page">
      {/* 헤더 */}
      <div className="survey-header">
        <div className="survey-progress-wrap">
          <div className="survey-progress-bar">
            <div className="survey-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="survey-progress-label">{answeredCount}/{TOTAL_QUESTIONS}</span>
        </div>
      </div>

      {/* 애니메이션 래퍼 */}
      <div className={`survey-content-wrap${isFadingOut ? ' fade-out' : ''}`}>
        {/* 카드형 문항 */}
        <div className="survey-questions">
          {pageQuestions.map((q, localIdx) => {
            const globalIdx = startIdx + localIdx
            const selected = answers[globalIdx]
            return (
              <div key={q.id} className="survey-card">
                <div className="survey-q-header">
                  <span className="survey-q-num">Q{globalIdx + 1}</span>
                </div>
                <p className="survey-q-text">{q.text}</p>
                <div className="survey-options-row">
                  <span className="survey-scale-label left">{LIKERT_LABELS[0]}</span>
                  <div className="survey-options">
                    {[1, 2, 3, 4, 5].map((val, i) => (
                      <label key={val} className={`survey-option-label${selected === val ? ' selected' : ''}`}>
                        <input
                          type="radio"
                          name={`q-${globalIdx}`}
                          value={val}
                          checked={selected === val}
                          onChange={() => handleSelect(globalIdx, val)}
                          className="survey-radio"
                        />
                        <span className={`survey-option-circle step-${i}`} />
                      </label>
                    ))}
                  </div>
                  <span className="survey-scale-label right">{LIKERT_LABELS[4]}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* 항상 하단에 이전 버튼 표시, 마지막 페이지엔 결과보기 버튼도 표시 */}
        <div className="survey-actions" style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button"
            className="btn-secondary" 
            onClick={handlePrev}
            style={{ width: page === TOTAL_PAGES - 1 ? '30%' : '100%', padding: '18px 0', fontSize: '1.05rem', background: '#f3f4f6', color: '#4b5563', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'width 0.2s' }}
          >
            ← 이전
          </button>
          
          {page === TOTAL_PAGES - 1 && (
            <button 
              className="btn-primary survey-next-btn" 
              onClick={() => {
                setIsFadingOut(true)
                setTimeout(() => proceedToNext(answers), 400)
              }}
              disabled={!pageQuestions.every((_, i) => answers[startIdx + i] !== 0)}
              style={{ flex: 1, margin: 0 }}
            >
              결과 보기 →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
