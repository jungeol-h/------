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
          나의 학습 유형과 강점을 발견하고<br />
          맞춤형 코칭을 받아보세요.
        </p>

        <div className="intro-info-list">
          <div className="intro-info-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span>30문항</span>
          </div>
          <div className="intro-info-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>약 5분</span>
          </div>
          <div className="intro-info-item highlight">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-5"></path></svg>
            <span>상세 분석과 실천 과제 제공</span>
          </div>
        </div>
      </div>

      <p className="intro-note">
        평가가 아닌 자기 이해의 도구입니다.<br />
        솔직하게 답할수록 정확한 피드백을 받을 수 있어요.
      </p>

      <button className="btn-primary intro-start-btn" onClick={() => navigate('/info')}>
        진단 시작하기
      </button>
    </div>
  )
}
