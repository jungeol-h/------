import { useNavigate } from 'react-router-dom'
import './IntroPage.css'

export default function IntroPage() {
  const navigate = useNavigate()

  return (
    <div className="intro-page">
      <div className="intro-hero">
        <div className="intro-badge">학습 자기 진단</div>
        <h1 className="intro-title">
          나는 어떤<br />학습자인가?
        </h1>
        <p className="intro-desc">
          30개의 짧은 질문으로<br />
          나의 학습 유형과 강점을 발견하고<br />
          맞춤형 코칭을 받아보세요.
        </p>
      </div>

      <div className="intro-info-cards">
        <div className="intro-info-card">
          <span>30문항</span>
        </div>
        <div className="intro-info-card">
          <span>약 5분</span>
        </div>
        <div className="intro-info-card">
          <span>맞춤 피드백</span>
        </div>
      </div>

      <button className="btn-primary intro-start-btn" onClick={() => navigate('/info')}>
        진단 시작하기
      </button>

      <p className="intro-note">
        평가가 아닌 자기 이해의 도구입니다.<br />
        솔직하게 답할수록 정확한 피드백을 받을 수 있어요.
      </p>
    </div>
  )
}
