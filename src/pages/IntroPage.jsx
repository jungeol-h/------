import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import './IntroPage.css'

export default function IntroPage() {
  const { dispatch } = useDiagnosis()
  const navigate = useNavigate()
  const [name, setName] = useState('')

  function handleStart() {
    dispatch({ type: 'RESET' })
    if (name.trim()) {
      dispatch({ type: 'SET_NAME', payload: name.trim() })
    }
    navigate('/survey')
  }

  return (
    <div className="intro-page">
      <div className="intro-hero">
        <div className="intro-badge">학습 자기 진단</div>
        <h1 className="intro-title">
          나를 이해하는<br />첫 번째 질문
        </h1>
        <p className="intro-desc">
          24개의 짧은 질문으로<br />
          나의 학습 유형과 강점을 발견하고<br />
          맞춤형 코칭을 받아보세요.
        </p>
      </div>

      <div className="intro-info-cards">
        <div className="intro-info-card">
          <span className="info-icon">📋</span>
          <span>24문항</span>
        </div>
        <div className="intro-info-card">
          <span className="info-icon">⏱</span>
          <span>약 5분</span>
        </div>
        <div className="intro-info-card">
          <span className="info-icon">🎯</span>
          <span>맞춤 피드백</span>
        </div>
      </div>

      <div className="intro-name-section">
        <label className="intro-name-label">이름을 입력해 주세요 <span>(선택)</span></label>
        <input
          className="intro-name-input"
          type="text"
          placeholder="홍길동"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleStart()}
          maxLength={10}
        />
      </div>

      <button className="btn-primary intro-start-btn" onClick={handleStart}>
        진단 시작하기
      </button>

      <p className="intro-note">
        평가가 아닌 자기 이해의 도구입니다.<br />
        솔직하게 답할수록 정확한 피드백을 받을 수 있어요.
      </p>
    </div>
  )
}
