import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import './PreSurveyPage.css'

const MBTI_OPTIONS = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
  '모르겠음',
]

const GRADE_LEVEL_OPTIONS = [
  '최상위권 (상위 10% 이내)',
  '상위권 (상위 10~30%)',
  '중위권 (상위 30~70%)',
  '하위권 (하위 30% 이내)',
  '잘 모르겠음',
]

export default function PreSurveyPage() {
  const { dispatch } = useDiagnosis()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    hardestSubject: '',
    mbti: '',
    gradeLevel: '',
    counselingTopic: '',
    career: '',
  })

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function handleNext() {
    dispatch({ type: 'SET_PRE_SURVEY', payload: form })
    navigate('/survey')
  }

  function handleSkip() {
    navigate('/survey')
  }

  return (
    <div className="presurvey-page">
      <div className="presurvey-header">
        <button className="survey-back-btn" onClick={() => navigate('/info')} aria-label="이전">←</button>
        <div className="presurvey-step">사전 설문</div>
      </div>

      <div className="presurvey-title-wrap">
        <h2 className="presurvey-title">학습 현황 파악</h2>
        <p className="presurvey-desc">
          더 정확한 코칭을 위해 간단한 정보를 알려 주세요.<br />
          모든 항목은 선택 사항입니다.
        </p>
      </div>

      <div className="presurvey-form">
        <div className="presurvey-field">
          <label className="presurvey-label">가장 힘들거나 어려운 과목은?</label>
          <input
            className="presurvey-input"
            name="hardestSubject"
            type="text"
            placeholder="예: 수학, 영어, 과학..."
            value={form.hardestSubject}
            onChange={handleChange}
            maxLength={30}
          />
        </div>

        <div className="presurvey-field">
          <label className="presurvey-label">MBTI (알고 있다면)</label>
          <select
            className="presurvey-select"
            name="mbti"
            value={form.mbti}
            onChange={handleChange}
          >
            <option value="">선택 안 함</option>
            {MBTI_OPTIONS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="presurvey-field">
          <label className="presurvey-label">현재 성적 수준</label>
          <select
            className="presurvey-select"
            name="gradeLevel"
            value={form.gradeLevel}
            onChange={handleChange}
          >
            <option value="">선택 안 함</option>
            {GRADE_LEVEL_OPTIONS.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="presurvey-field">
          <label className="presurvey-label">상담 받고 싶은 사항</label>
          <textarea
            className="presurvey-textarea"
            name="counselingTopic"
            placeholder="예: 공부 집중이 안 돼요, 성적이 잘 오르지 않아요..."
            value={form.counselingTopic}
            onChange={handleChange}
            rows={3}
            maxLength={200}
          />
          <span className="presurvey-count">{form.counselingTopic.length}/200</span>
        </div>

        <div className="presurvey-field">
          <label className="presurvey-label">희망 진로 또는 관심 분야</label>
          <textarea
            className="presurvey-textarea"
            name="career"
            placeholder="예: 의사, 디자이너, IT 개발자, 아직 잘 모르겠음..."
            value={form.career}
            onChange={handleChange}
            rows={2}
            maxLength={100}
          />
          <span className="presurvey-count">{form.career.length}/100</span>
        </div>
      </div>

      <div className="presurvey-actions">
        <button className="btn-primary presurvey-next-btn" onClick={handleNext}>
          진단 시작하기
        </button>
        <button className="presurvey-skip-btn" onClick={handleSkip}>
          건너뛰기
        </button>
      </div>
    </div>
  )
}
