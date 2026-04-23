import { useState, useEffect } from 'react'
import { useAdminConfig } from '../context/AdminConfigContext'
import { saveAdminConfig } from '../lib/adminConfig'
import { DOMAIN_LABELS, DOMAIN_ORDER } from '../data/questions'
import './AdminPage.css'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'gooooookee2024'

const GRADES = ['A', 'B', 'C', 'D', 'E']
const GRADE_DESC = { A: '90점 이상', B: '80~89점', C: '70~79점', D: '60~69점', E: '60점 미만' }

const TABS = [
  { id: 'logic', label: '📊 로직 설명' },
  { id: 'feedback', label: '💬 영역별 피드백' },
  { id: 'cards', label: '🎯 실천 카드' },
]

// ── 로직 설명 탭 ──────────────────────────────────────────────
function LogicTab() {
  return (
    <div className="admin-logic">
      <h2 className="admin-section-title">진단 로직 설명</h2>
      <p className="admin-logic-desc">이 탭은 읽기 전용입니다. 진단 결과가 어떻게 계산되는지 설명합니다.</p>

      <div className="admin-logic-card">
        <h3>① 점수 계산 방식</h3>
        <p>학생이 각 문항에 1~5점으로 답변합니다. 영역별 문항 점수의 합을 최대 점수로 나눠 <strong>0~100점</strong>으로 환산합니다.</p>
        <div className="admin-logic-formula">
          영역 점수 = (해당 영역 답변 합계 ÷ 문항 수 × 5) × 100
        </div>
      </div>

      <div className="admin-logic-card">
        <h3>② 등급 결정</h3>
        <div className="admin-grade-table">
          {[['A', '90점 이상', '최상'], ['B', '80~89점', '상'], ['C', '70~79점', '중'], ['D', '60~69점', '하'], ['E', '60점 미만', '최하']].map(([g, range, label]) => (
            <div key={g} className="admin-grade-row">
              <span className={`admin-grade-badge grade-${g}`}>{g}</span>
              <span className="admin-grade-range">{range}</span>
              <span className="admin-grade-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-logic-card">
        <h3>③ 학습자 유형 결정</h3>
        <p>6개 영역의 등급을 A=5, B=4, C=3, D=2, E=1점으로 환산한 뒤, 아래 3개 그룹 평균을 계산합니다.</p>
        <div className="admin-logic-groups">
          <div className="admin-logic-group">
            <span className="admin-group-badge">주도형</span>
            <span>자아효능감 + 학습의지 + 비전 평균</span>
          </div>
          <div className="admin-logic-group">
            <span className="admin-group-badge">전략형</span>
            <span>효율성 + 학습환경 평균</span>
          </div>
          <div className="admin-logic-group">
            <span className="admin-group-badge">노력형</span>
            <span>성실성 점수</span>
          </div>
        </div>
        <p style={{ marginTop: '12px' }}>상위 2개 그룹 점수를 비교해 아래 6개 유형 중 하나를 결정합니다.</p>
        <div className="admin-type-list">
          {['주도형 학습자', '전략형 학습자', '노력형 학습자', '주도·전략형 학습자', '주도·노력형 학습자', '전략·노력형 학습자'].map(t => (
            <span key={t} className="admin-type-chip">{t}</span>
          ))}
        </div>
        <p className="admin-logic-note">※ 3그룹 모두 동점이면 <strong>주도·전략형 학습자</strong>로 자동 결정됩니다.</p>
      </div>

      <div className="admin-logic-card">
        <h3>④ 보완점 생성</h3>
        <p>등급이 가장 낮은 영역 1~2개를 선택해 표시합니다. A등급 영역은 보완점에서 제외됩니다.</p>
        <div className="admin-supplement-table">
          {[['B', '강화 필요'], ['C', '보완 필요'], ['D / E', '집중 개선 필요']].map(([g, expr]) => (
            <div key={g} className="admin-supplement-row">
              <span className="admin-grade-badge">{g}</span>
              <span>→ <strong>{expr}</strong></span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-logic-card">
        <h3>⑤ 실천 카드 선택</h3>
        <p>보완 영역 상위 2개의 카드 세트 1번이 선택되고, 마지막 3번째 카드는 <strong>종합 학습 습관 강화</strong> 고정 카드입니다.</p>
      </div>
    </div>
  )
}

// ── 영역별 피드백 탭 ──────────────────────────────────────────
function FeedbackTab({ feedbackLib, onChange }) {
  const [activeDomain, setActiveDomain] = useState(DOMAIN_ORDER[0])
  const [activeGrade, setActiveGrade] = useState('A')

  const current = feedbackLib[activeDomain]?.[activeGrade] || { strength: '', weakness: '', coaching: '' }

  function handleField(field, value) {
    onChange(activeDomain, activeGrade, field, value)
  }

  return (
    <div className="admin-feedback">
      <h2 className="admin-section-title">영역별 피드백 문구</h2>
      <p className="admin-logic-desc">영역과 등급을 선택한 뒤 문구를 수정하세요. 저장 버튼을 눌러야 반영됩니다.</p>

      <div className="admin-domain-tabs">
        {DOMAIN_ORDER.map(d => (
          <button
            key={d}
            className={`admin-domain-tab${activeDomain === d ? ' active' : ''}`}
            onClick={() => setActiveDomain(d)}
          >
            {DOMAIN_LABELS[d]}
          </button>
        ))}
      </div>

      <div className="admin-grade-tabs">
        {GRADES.map(g => (
          <button
            key={g}
            className={`admin-grade-tab${activeGrade === g ? ' active' : ''}`}
            onClick={() => setActiveGrade(g)}
          >
            {g}등급 <span className="admin-grade-tab-desc">({GRADE_DESC[g]})</span>
          </button>
        ))}
      </div>

      <div className="admin-feedback-fields">
        <div className="admin-field">
          <label className="admin-label">강점 <span className="admin-label-hint">학생의 현재 강점을 짧게 (1줄)</span></label>
          <input
            className="admin-input"
            value={current.strength}
            onChange={e => handleField('strength', e.target.value)}
            placeholder="예: 스스로 해낼 수 있다는 자기 확신이 있음"
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">보완 <span className="admin-label-hint">보완이 필요한 부분 (1줄)</span></label>
          <input
            className="admin-input"
            value={current.weakness}
            onChange={e => handleField('weakness', e.target.value)}
            placeholder="예: 자신감에만 의존하지 않고 과정 점검 필요"
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">코칭 <span className="admin-label-hint">구체적인 코칭 멘트 (2~4줄)</span></label>
          <textarea
            className="admin-textarea"
            value={current.coaching}
            onChange={e => handleField('coaching', e.target.value)}
            rows={4}
            placeholder="예: 이미 해낼 수 있다는 믿음이 충분히 형성되어 있는 상태예요..."
          />
        </div>
      </div>
    </div>
  )
}

// ── 실천 카드 탭 ──────────────────────────────────────────────
function CardsTab({ cards, onChange }) {
  const allDomains = [...DOMAIN_ORDER, 'overall']
  const domainLabel = { ...DOMAIN_LABELS, overall: '종합 (고정 3번 카드)' }
  const [activeDomain, setActiveDomain] = useState(DOMAIN_ORDER[0])

  const domainCards = cards[activeDomain] || []

  function handleCardField(setIdx, field, value) {
    onChange(activeDomain, setIdx, field, value)
  }

  function handleBoostField(setIdx, boostIdx, value) {
    onChange(activeDomain, setIdx, `boost.${boostIdx}`, value)
  }

  return (
    <div className="admin-cards">
      <h2 className="admin-section-title">실천 카드 문구</h2>
      <p className="admin-logic-desc">각 영역의 카드 세트 1번이 보완점으로 선택됩니다. 종합 카드는 항상 3번째에 표시됩니다.</p>

      <div className="admin-domain-tabs" style={{ flexWrap: 'wrap' }}>
        {allDomains.map(d => (
          <button
            key={d}
            className={`admin-domain-tab${activeDomain === d ? ' active' : ''}`}
            onClick={() => setActiveDomain(d)}
          >
            {domainLabel[d]}
          </button>
        ))}
      </div>

      <div className="admin-cards-list">
        {domainCards.map((card, setIdx) => (
          <div key={setIdx} className="admin-card-set">
            <div className="admin-card-set-header">
              세트 {setIdx + 1}{setIdx === 0 ? <span className="admin-card-used-badge">진단에 사용됨</span> : ''}
            </div>

            <div className="admin-field">
              <label className="admin-label">카드 제목</label>
              <input
                className="admin-input"
                value={card.title || ''}
                onChange={e => handleCardField(setIdx, 'title', e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">핵심 과제 <span className="admin-label-hint">구체적 행동 + 시간/분량 포함</span></label>
              <textarea
                className="admin-textarea"
                value={card.core || ''}
                onChange={e => handleCardField(setIdx, 'core', e.target.value)}
                rows={2}
              />
            </div>
            {[0, 1].map(bi => (
              <div key={bi} className="admin-field">
                <label className="admin-label">강화 과제 {bi + 1}</label>
                <textarea
                  className="admin-textarea"
                  value={Array.isArray(card.boost) ? (card.boost[bi] || '') : (bi === 0 ? card.boost || '' : '')}
                  onChange={e => handleBoostField(setIdx, bi, e.target.value)}
                  rows={2}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 메인 AdminPage ─────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [activeTab, setActiveTab] = useState('logic')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const { config, setConfig } = useAdminConfig()

  // 로컬 편집 상태 (저장 전까지 config와 분리)
  const [localFeedback, setLocalFeedback] = useState(null)
  const [localCards, setLocalCards] = useState(null)

  useEffect(() => {
    if (config) {
      setLocalFeedback(JSON.parse(JSON.stringify(config.feedbackLibrary)))
      setLocalCards(JSON.parse(JSON.stringify(config.practiceCards)))
    }
  }, [config])

  function handleLogin(e) {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true)
    } else {
      setPwError(true)
      setTimeout(() => setPwError(false), 1500)
    }
  }

  function handleFeedbackChange(domain, grade, field, value) {
    setLocalFeedback(prev => ({
      ...prev,
      [domain]: {
        ...prev[domain],
        [grade]: {
          ...prev[domain]?.[grade],
          [field]: value,
        },
      },
    }))
  }

  function handleCardChange(domain, setIdx, field, value) {
    setLocalCards(prev => {
      const next = { ...prev }
      const domainCards = [...(next[domain] || [])]
      const card = { ...domainCards[setIdx] }

      if (field.startsWith('boost.')) {
        const bi = parseInt(field.split('.')[1])
        const boostArr = Array.isArray(card.boost) ? [...card.boost] : [card.boost || '', '']
        boostArr[bi] = value
        card.boost = boostArr
      } else {
        card[field] = value
      }

      domainCards[setIdx] = card
      next[domain] = domainCards
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    try {
      await Promise.all([
        saveAdminConfig('feedbackLibrary', localFeedback),
        saveAdminConfig('practiceCards', localCards),
      ])
      setConfig({ feedbackLibrary: localFeedback, practiceCards: localCards })
      setSaveMsg('저장되었습니다.')
    } catch (err) {
      setSaveMsg('저장 실패: ' + (err.message || '네트워크 오류'))
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  // ── 비밀번호 화면 ──
  if (!authed) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <h1 className="admin-login-title">관리자 로그인</h1>
          <p className="admin-login-sub">고모 진단 서비스 어드민</p>
          <form onSubmit={handleLogin} className="admin-login-form">
            <input
              type="password"
              className={`admin-login-input${pwError ? ' error' : ''}`}
              placeholder="비밀번호를 입력하세요"
              value={pw}
              onChange={e => setPw(e.target.value)}
              autoFocus
            />
            {pwError && <p className="admin-login-error">비밀번호가 틀렸습니다.</p>}
            <button type="submit" className="admin-login-btn">입장</button>
          </form>
        </div>
      </div>
    )
  }

  if (!localFeedback || !localCards) {
    return <div className="admin-loading">설정을 불러오는 중...</div>
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div>
            <h1 className="admin-title">관리자 설정</h1>
            <p className="admin-subtitle">진단 결과 문구를 수정하고 저장하세요.</p>
          </div>
          <div className="admin-header-actions">
            {saveMsg && <span className={`admin-save-msg${saveMsg.includes('실패') ? ' error' : ''}`}>{saveMsg}</span>}
            {activeTab !== 'logic' && (
              <button
                className="admin-save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '저장 중...' : '💾 저장'}
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`admin-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="admin-main">
        {activeTab === 'logic' && <LogicTab />}
        {activeTab === 'feedback' && (
          <FeedbackTab feedbackLib={localFeedback} onChange={handleFeedbackChange} />
        )}
        {activeTab === 'cards' && (
          <CardsTab cards={localCards} onChange={handleCardChange} />
        )}
      </main>
    </div>
  )
}
