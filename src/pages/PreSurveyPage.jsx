import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDiagnosis } from '../context/DiagnosisContext'
import './PreSurveyPage.css'

const SUBJECT_OPTIONS = ['국어', '영어', '수학', '사회', '과학', '기타']

const MBTI_AXES = [
  { key: 0, options: [{ id: 'E', label: '외향' }, { id: 'I', label: '내향' }] },
  { key: 1, options: [{ id: 'S', label: '감각' }, { id: 'N', label: '직관' }] },
  { key: 2, options: [{ id: 'T', label: '사고' }, { id: 'F', label: '감정' }] },
  { key: 3, options: [{ id: 'J', label: '판단' }, { id: 'P', label: '인식' }] },
]

const GRADE_LEVEL_OPTIONS = [
  '최상위권 (10%내)',
  '상위권 (10~30%)',
  '중위권 (30~70%)',
  '하위권 (70~100%)',
  '잘 모르겠음',
]

export default function PreSurveyPage() {
  const { state, dispatch } = useDiagnosis()
  const navigate = useNavigate()

  const [form, setForm] = useState(state.preSurvey)
  
  const [isOtherSubject, setIsOtherSubject] = useState(() => {
    const cur = state.preSurvey['가장 어려운 과목']
    return cur !== '' && !['국어', '영어', '수학', '사회', '과학'].includes(cur)
  })
  
  const [mbtiParts, setMbtiParts] = useState(() => {
    const val = state.preSurvey['MBTI'] || ''
    const parts = ['', '', '', '']
    if (val.includes('E')) parts[0] = 'E'
    else if (val.includes('I')) parts[0] = 'I'
    if (val.includes('S')) parts[1] = 'S'
    else if (val.includes('N')) parts[1] = 'N'
    if (val.includes('T')) parts[2] = 'T'
    else if (val.includes('F')) parts[2] = 'F'
    if (val.includes('J')) parts[3] = 'J'
    else if (val.includes('P')) parts[3] = 'P'
    return parts
  })

  const [errors, setErrors] = useState({})

  function handleChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }
  
  function handleSubjectClick(s) {
    setErrors(prev => ({ ...prev, subject: '' }))
    if (s === '기타') {
      setIsOtherSubject(true)
      setForm(f => ({ ...f, '가장 어려운 과목': '' }))
    } else {
      setIsOtherSubject(false)
      setForm(f => ({ ...f, '가장 어려운 과목': s }))
    }
  }

  function handleMbtiClick(axisIdx, val) {
    setErrors(prev => ({ ...prev, mbti: '' }))
    const newParts = [...mbtiParts]
    newParts[axisIdx] = newParts[axisIdx] === val ? '' : val
    setMbtiParts(newParts)
    
    // 유효한 4글자 MBTI가 완성되었거나, 일부만 선택되었을 때 업데이트
    const full = newParts.join('')
    setForm(f => ({ ...f, 'MBTI': full }))
  }

  function handleNext() {
    const newErrors = {}
    if (!form['가장 어려운 과목']?.trim()) newErrors.subject = '필수 항목입니다.'
    
    // MBTI는 공백 없이 4글자여야 함
    const mbtiLen = mbtiParts.filter(p => p !== '').length
    if (mbtiLen < 4) newErrors.mbti = '4가지 성향을 모두 선택해 주세요.'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    dispatch({ type: 'SET_PRE_SURVEY', payload: form })
    navigate('/survey')
  }

  return (
    <div className="presurvey-page">
      <div className="presurvey-header">
        <div className="presurvey-step">사전 설문</div>
      </div>

      <div className="presurvey-title-wrap">
        <h2 className="presurvey-title">학습 현황 파악</h2>
        <p className="presurvey-desc">
          더 정확한 코칭을 위해 정보를 알려 주세요.
        </p>
      </div>

      <div className="presurvey-form">
        <div className="presurvey-field">
          <label className="presurvey-label">가장 어려운 과목은? <span className="required">*</span></label>
          <div className="subject-grid">
            {SUBJECT_OPTIONS.map(s => (
              <button
                key={s}
                type="button"
                className={`subject-btn${(s === '기타' ? isOtherSubject : form['가장 어려운 과목'] === s && !isOtherSubject) ? ' active' : ''}${errors.subject ? ' error' : ''}`}
                onClick={() => handleSubjectClick(s)}
              >
                {s}
              </button>
            ))}
          </div>
          {isOtherSubject && (
            <input
              className={`presurvey-input${errors.subject ? ' error' : ''}`}
              type="text"
              placeholder="직접 입력 (예: 한국사)"
              value={form['가장 어려운 과목']}
              onChange={(e) => {
                setForm(f => ({ ...f, '가장 어려운 과목': e.target.value }))
                setErrors(prev => ({ ...prev, subject: '' }))
              }}
              autoFocus
            />
          )}
          {errors.subject && <span className="form-error">{errors.subject}</span>}
        </div>

        <div className="presurvey-field">
          <label className="presurvey-label">나의 MBTI <span className="required">*</span></label>
          <div className="mbti-axes">
            {MBTI_AXES.map((axis) => (
              <div key={axis.key} className="mbti-axis-row">
                {axis.options.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`mbti-btn${mbtiParts[axis.key] === opt.id ? ' active' : ''}${errors.mbti ? ' error' : ''}`}
                    onClick={() => handleMbtiClick(axis.key, opt.id)}
                  >
                    <span className="mbti-letter">{opt.id}</span>
                    <span className="mbti-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          {errors.mbti && <span className="form-error">{errors.mbti}</span>}
        </div>

        <div className="presurvey-field">
          <label className="presurvey-label">학습 성취도 수준</label>
          <select
            className="presurvey-select"
            name="학습 성취도 수준"
            value={form['학습 성취도 수준']}
            onChange={handleChange}
          >
            <option value="">선택 안 함</option>
            {GRADE_LEVEL_OPTIONS.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="presurvey-field">
          <label className="presurvey-label">상담 및 코칭 희망 내용</label>
          <textarea
            className="presurvey-textarea"
            name="상담 및 코칭 희망 내용"
            placeholder="공부 집중력, 성적 고민 등 자유롭게 적어주세요."
            value={form['상담 및 코칭 희망 내용']}
            onChange={handleChange}
            rows={2}
            maxLength={200}
          />
        </div>

        <div className="presurvey-field">
          <label className="presurvey-label">희망 진로 및 관심 분야</label>
          <textarea
            className="presurvey-textarea"
            name="희망 진로 및 관심 분야"
            placeholder="예: 의사, IT 개발자, 아직 잘 모르겠음..."
            value={form['희망 진로 및 관심 분야']}
            onChange={handleChange}
            rows={2}
            maxLength={100}
          />
          <span className="presurvey-count">{form['희망 진로 및 관심 분야'].length}/100</span>
        </div>
      </div>

      <div className="presurvey-actions">
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <button 
            type="button"
            className="btn-secondary" 
            onClick={() => {
              dispatch({ type: 'SET_PRE_SURVEY', payload: form })
              navigate('/info')
            }}
            style={{ width: '30%', padding: '18px 0', fontSize: '1.05rem', background: '#f3f4f6', color: '#4b5563', borderRadius: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            ← 이전
          </button>
          <button 
            className="btn-primary presurvey-next-btn" 
            onClick={handleNext}
            style={{ flex: 1, marginTop: 0 }}
          >
            진단 시작하기 →
          </button>
        </div>
      </div>
    </div>
  )
}
