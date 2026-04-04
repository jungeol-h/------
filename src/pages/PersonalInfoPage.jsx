import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import './PersonalInfoPage.css'

const MIDDLE_GRADES = ['중학교 1학년', '중학교 2학년', '중학교 3학년']
const HIGH_GRADES = ['고등학교 1학년', '고등학교 2학년', '고등학교 3학년']

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
    studentName: state.studentName || '',
    school: state.school || '',
    grade: state.grade || '',
    studentPhone: state.studentPhone || '',
    parentPhone: state.parentPhone || '',
  })
  const [agreed, setAgreed] = useState(state.agreed || false)
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

  function handleBlur(e) {
    const { name, value } = e.target
    if (name === 'school') {
      let formatted = value.trim()
      if (formatted.endsWith('초') && !formatted.endsWith('초등학교')) {
        formatted += '등학교'
      } else if (formatted.endsWith('초등') && !formatted.endsWith('초등학교')) {
        formatted += '학교'
      } else if (formatted.endsWith('중') && !formatted.endsWith('중학교')) {
        formatted += '학교'
      } else if (formatted.endsWith('고') && !formatted.endsWith('고등학교')) {
        formatted += '등학교'
      } else if (formatted.endsWith('고등') && !formatted.endsWith('고등학교')) {
        formatted += '학교'
      }

      if (formatted !== value) {
        setForm(f => ({ ...f, [name]: formatted }))
      }
    }
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
    dispatch({ type: 'SET_PERSONAL_INFO', payload: { ...form, agreed } })
    navigate('/pre-survey')
  }

  return (
    <div className="personal-page">
      <div className="personal-header">
        <div className="personal-header-top">
          <div className="intro-badge">학습 자기 진단</div>
        </div>
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
            value={form.school}
            onChange={handleChange}
            onBlur={handleBlur}
            maxLength={20}
          />
          {errors.school && <span className="form-error">{errors.school}</span>}
        </div>

        <div className="form-field">
          <label className="form-label">학년 <span className="required">*</span></label>
          <div className="grade-selector">
            {!form.school.includes('중') && !form.school.includes('고') ? (
              <p className="grade-hint">학교명을 먼저 입력해 주세요.</p>
            ) : (
              <div className="grade-group">
                <span className="grade-group-label">
                  {form.school.includes('중') ? '중학교' : '고등학교'}
                </span>
                <div className="grade-button-grid">
                  {(form.school.includes('중') ? MIDDLE_GRADES : HIGH_GRADES).map(g => (
                    <button
                      key={g}
                      type="button"
                      className={`grade-btn${form.grade === g ? ' active' : ''}${errors.grade ? ' error' : ''}`}
                      onClick={() => {
                        setForm(f => ({ ...f, grade: g }))
                        setErrors(err => ({ ...err, grade: '' }))
                      }}
                    >
                      {g.replace('중학교 ', '').replace('고등학교 ', '')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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

      <p className="personal-note">
        입력하신 정보는 진단 결과 안내 목적으로만 사용됩니다.
      </p>

      <div className="personal-actions" style={{ display: 'flex', gap: '8px' }}>
        <button 
          type="button"
          className="btn-secondary" 
          onClick={() => {
            dispatch({ type: 'SET_PERSONAL_INFO', payload: { ...form, agreed } })
            navigate('/')
          }}
          style={{ width: '30%', padding: '18px 0', fontSize: '1.05rem', background: '#f3f4f6', color: '#4b5563', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          ← 이전
        </button>
        <button 
          type="button"
          className="btn-primary personal-next-btn" 
          onClick={handleNext}
          style={{ flex: 1, marginTop: 0 }}
        >
          다음 →
        </button>
      </div>
    </div>
  )
}
