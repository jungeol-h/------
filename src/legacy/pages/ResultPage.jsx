import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import ResultTabNav from '../components/result/ResultTabNav'
import Page1Summary from '../components/result/Page1Summary'
import Page2Detail from '../components/result/Page2Detail'
import Page3Coaching from '../components/result/Page3Coaching'
import { saveDiagnosisResult } from '../lib/saveResult'
import './ResultPage.css'

export default function ResultPage() {
  const { state, dispatch } = useDiagnosis()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(1)
  const savedRef = useRef(false)

  useEffect(() => {
    if (state.result && !savedRef.current) {
      savedRef.current = true
      saveDiagnosisResult(state).catch(e => console.error('[DB 저장 실패]', e))
    }
  }, [state])

  const { result } = state

  function handleRestart() {
    dispatch({ type: 'RESET' })
    window.location.href = '/'
  }

  return (
    <div className="result-page">
      <div className="result-header">
        <div className="result-header-top">
          <h1 className="result-header-title">학습 진단 결과</h1>
          <button className="result-restart-btn" onClick={handleRestart}>
            다시하기
          </button>
        </div>
        <ResultTabNav activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="result-content">
        {activeTab === 1 && <Page1Summary result={result} />}
        {activeTab === 2 && <Page2Detail result={result} />}
        {activeTab === 3 && <Page3Coaching result={result} />}
      </div>

      <div className="result-tab-nav-bottom">
        <div className="result-tab-dots">
          {[1, 2, 3].map(t => (
            <button
              key={t}
              className={`result-tab-dot ${activeTab === t ? 'active' : ''}`}
              onClick={() => setActiveTab(t)}
              aria-label={`${t}페이지`}
            />
          ))}
        </div>
        <div className="result-nav-btns">
          {activeTab > 1 && (
            <button className="result-nav-btn" onClick={() => setActiveTab(activeTab - 1)}>
              ← 이전
            </button>
          )}
          {activeTab < 3 && (
            <button className="result-nav-btn primary" onClick={() => setActiveTab(activeTab + 1)}>
              다음 →
            </button>
          )}
          {activeTab === 3 && (
            <button className="result-nav-btn primary" onClick={() => navigate('/complete')}>
              결과지 저장 →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
