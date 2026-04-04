import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import './PersonalInfoPage.css'

const GRADE_OPTIONS = [
  '중학교 1학년', '중학교 2학년', '중학교 3학년',
  '고등학교 1학년', '고등학교 2학년', '고등학교 3학년',
]

const MBTI_OPTIONS = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
  '모르겠음',
]

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

export default function PersonalInfoPage() {
  const { state, dispatch } = useDiagnosis()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    studentName: '',
    school: '',
    grade: '',
    studentPhone: '',
    parentPhone: '',
    mbti: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [errors, setErrors] = useState({})

  function handleChange(e) {
    const { name, value } = e.target
    if (name === 'studentPhone' || name === 'parentPhone') {
      setForm(f => ({ ...f, [name]: formatPhone(value) }))
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
    setErrors(err => ({ ...err, [name]: '' }))
  }

  function validate() {
    const newErrors = {}
    if (!form.studentName.trim()) newErrors.studentName = '이름을 입력해 주세요'
    if (!form.school.trim()) newErrors.school = '학교명을 입력해 주세요'
    if (!form.grade) newErrors.grade = '학년을 선택해 주세요'
    if (!form.studentPhone.trim()) newErrors.studentPhone = '학생 휴대폰 번호를 입력해 주세요'
    if (!agreed) newErrors.agreed = '개인정보 수집에 동의해 주세요'
    return newErrors
  }

  function handleNext() {
    const newErrors = validate()
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    if (state.result) {
      dispatch({ type: 'RESET' })
    }
    dispatch({ type: 'SET_PERSONAL_INFO', payload: form })
    navigate('/pre-survey')
  }

  return (
    <div className="personal-page">
      <div className="personal-header">
        <div className="intro-badge">학습 자기 진단</div>
        <h1 className="personal-title">기본 정보 입력</h1>
        <p className="personal-desc">진단 결과 안내를 위해 정보를 입력해 주세요.</p>
      </div>

      <div className="personal-form">
        <div className="form-field">
          <label className="form-label">이름 <span className="required">*</span></label>
          <input
            className={`form-input${errors.studentName ? ' error' : ''}`}
            name="studentName"
            type="text"
            placeholder="홍길동"
            value={form.studentName}
            onChange={handleChange}
            maxLength={10}
          />
          {errors.studentName && <span className="form-error">{errors.studentName}</span>}
        </div>

        <div className="form-field">
          <label className="form-label">학교명 <span className="required">*</span></label>
          <input
            className={`form-input${errors.school ? ' error' : ''}`}
            name="school"
            type="text"
            placeholder="○○중학교 / ○○고등학교"
            value={form.school}
            onChange={handleChange}
            maxLength={20}
          />
          {errors.school && <span className="form-error">{errors.school}</span>}
        </div>

        <div className="form-field">
          <label className="form-label">학년 <span className="required">*</span></label>
          <select
            className={`form-select${errors.grade ? ' error' : ''}`}
            name="grade"
            value={form.grade}
            onChange={handleChange}
          >
            <option value="">학년 선택</option>
            {GRADE_OPTIONS.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          {errors.grade && <span className="form-error">{errors.grade}</span>}
        </div>

        <div className="form-field">
          <label className="form-label">학생 휴대폰 번호 <span className="required">*</span></label>
          <input
            className={`form-input${errors.studentPhone ? ' error' : ''}`}
            name="studentPhone"
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={form.studentPhone}
            onChange={handleChange}
          />
          {errors.studentPhone && <span className="form-error">{errors.studentPhone}</span>}
        </div>

        <div className="form-field">
          <label className="form-label">보호자 휴대폰 번호 <span className="optional">(선택)</span></label>
          <input
            className="form-input"
            name="parentPhone"
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={form.parentPhone}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label className="form-label">MBTI <span className="optional">(선택)</span></label>
          <select
            className="form-select"
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

        {/* 개인정보 동의 */}
        <div className="privacy-section">
          <button
            type="button"
            className="privacy-toggle"
            onClick={() => setShowPrivacy(v => !v)}
          >
            개인정보 수집 및 이용 동의 {showPrivacy ? '▲' : '▼'}
          </button>

          {showPrivacy && (
            <div className="privacy-content">
              <p><strong>수집 항목:</strong> 이름, 학교, 학년, 학생 휴대폰 번호, 보호자 휴대폰 번호</p>
              <p><strong>수집 목적:</strong> 학습 진단 결과 안내 및 맞춤형 코칭 피드백 제공</p>
              <p><strong>보유 기간:</strong> 서비스 이용 종료 시까지 또는 동의 철회 시까지</p>
              <p><strong>제3자 제공:</strong> 원칙적으로 외부에 제공하지 않습니다.</p>
              <p className="privacy-notice">위 내용에 동의하지 않으실 경우 서비스 이용이 제한될 수 있습니다.</p>
            </div>
          )}

          <label className={`privacy-agree${errors.agreed ? ' error' : ''}`}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => {
                setAgreed(e.target.checked)
                setErrors(err => ({ ...err, agreed: '' }))
              }}
            />
            <span>개인정보 수집 및 이용에 동의합니다 <span className="required">*</span></span>
          </label>
          {errors.agreed && <span className="form-error">{errors.agreed}</span>}
        </div>
      </div>

      <button className="btn-primary personal-next-btn" onClick={handleNext}>
        다음
      </button>

      <p className="personal-note">
        입력하신 정보는 진단 결과 안내 목적으로만 사용됩니다.
      </p>
    </div>
  )
}
