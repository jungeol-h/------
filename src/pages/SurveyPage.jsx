import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import { questions, LIKERT_LABELS, TOTAL_QUESTIONS } from '../data/questions'
import { buildResult } from '../utils/scoreCalculator'
import './SurveyPage.css'

const QUESTIONS_PER_PAGE = 3
const TOTAL_PAGES = Math.ceil(TOTAL_QUESTIONS / QUESTIONS_PER_PAGE)

export default function SurveyPage() {
  const { state, dispatch } = useDiagnosis()
  const navigate = useNavigate()
  const [page, setPage] = useState(0) // 0-indexed
  const [answers, setAnswers] = useState(() => new Array(TOTAL_QUESTIONS).fill(0))
  const [errors, setErrors] = useState([])

  // 현재 페이지에 해당하는 문항 인덱스들
  const startIdx = page * QUESTIONS_PER_PAGE
  const pageQuestions = questions.slice(startIdx, startIdx + QUESTIONS_PER_PAGE)

  function handleSelect(questionIdx, value) {
    setAnswers(prev => {
      const next = [...prev]
      next[questionIdx] = value
      return next
    })
    // 해당 문항 에러 제거
    setErrors(prev => prev.filter(i => i !== questionIdx))
  }

  function validate() {
    const unanswered = pageQuestions
      .map((_, i) => startIdx + i)
      .filter(i => answers[i] === 0)
    setErrors(unanswered)
    return unanswered.length === 0
  }

  function handleNext() {
    if (!validate()) return
    if (page < TOTAL_PAGES - 1) {
      setPage(p => p + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // 완료 - 결과 계산 (원래 순서 그대로 사용)
      const result = buildResult(answers, state.studentName)
      dispatch({ type: 'SET_SURVEY_RESULT', payload: { answers, result } })
      navigate('/result')
    }
  }

  function handlePrev() {
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
        <button className="survey-back-btn" onClick={handlePrev} aria-label="이전">←</button>
        <div className="survey-progress-wrap">
          <div className="survey-progress-bar">
            <div className="survey-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="survey-progress-label">{answeredCount}/{TOTAL_QUESTIONS}</span>
        </div>
      </div>

      {/* 페이지 표시 */}
      <div className="survey-page-indicator">
        {page + 1} / {TOTAL_PAGES} 페이지
      </div>

      {/* 테이블형 문항 */}
      <div className="survey-table-wrap">
        <table className="survey-table">
          <thead>
            <tr>
              <th className="survey-th-question">문항</th>
              {LIKERT_LABELS.map((label, i) => (
                <th key={i} className="survey-th-option">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageQuestions.map((q, localIdx) => {
              const globalIdx = startIdx + localIdx
              const selected = answers[globalIdx]
              const hasError = errors.includes(globalIdx)
              return (
                <tr key={q.id} className={`survey-tr${hasError ? ' survey-tr-error' : ''}`}>
                  <td className="survey-td-question">
                    <span className="survey-q-num">{globalIdx + 1}</span>
                    <span className="survey-q-text">{q.text}</span>
                  </td>
                  {[1, 2, 3, 4, 5].map(val => (
                    <td key={val} className="survey-td-option">
                      <label className="survey-radio-label">
                        <input
                          type="radio"
                          name={`q-${globalIdx}`}
                          value={val}
                          checked={selected === val}
                          onChange={() => handleSelect(globalIdx, val)}
                          className="survey-radio"
                        />
                        <span className={`survey-radio-circle${selected === val ? ' selected' : ''}`} />
                      </label>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {errors.length > 0 && (
          <p className="survey-error-msg">모든 문항에 답해 주세요.</p>
        )}
      </div>

      {/* 범례 (모바일에서 헤더 레이블 보완) */}
      <div className="survey-legend">
        {LIKERT_LABELS.map((label, i) => (
          <div key={i} className="survey-legend-item">
            <span className="survey-legend-num">{i + 1}</span>
            <span className="survey-legend-text">{label}</span>
          </div>
        ))}
      </div>

      {/* 다음 버튼 */}
      <button className="btn-primary survey-next-btn" onClick={handleNext}>
        {page < TOTAL_PAGES - 1 ? '다음 →' : '결과 보기'}
      </button>
    </div>
  )
}
