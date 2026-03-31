import { questions, DOMAIN_ORDER } from '../data/questions'
import { feedbackLibrary, practiceCards as practiceCardData } from '../data/feedbackLibrary'
import { buildOverallComment, buildMindCoaching, buildPracticeCoaching } from '../data/coachingTemplates'

// Step 1: answers 배열(24개) → 영역별 점수 (100점 환산)
export function calcDomainScores(answers) {
  const domainAnswers = {}

  questions.forEach((q, idx) => {
    if (!domainAnswers[q.domain]) domainAnswers[q.domain] = []
    domainAnswers[q.domain].push(answers[idx] || 3)
  })

  const scores = {}
  for (const [domain, vals] of Object.entries(domainAnswers)) {
    const sum = vals.reduce((a, b) => a + b, 0)
    scores[domain] = Math.round((sum / (vals.length * 5)) * 100)
  }
  return scores
}

// Step 2: 점수 → A~E 등급
export function scoreToGrade(score) {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'E'
}

export function calcDomainGrades(domainScores) {
  const grades = {}
  for (const [domain, score] of Object.entries(domainScores)) {
    grades[domain] = scoreToGrade(score)
  }
  return grades
}

// Step 3: 3개 핵심 지표 점수
export function calcCoreIndicators(domainScores) {
  const { selfEfficacy, learningWill, vision, efficiency, environment, diligence } = domainScores
  return {
    leadership: Math.round((selfEfficacy + learningWill + vision) / 3),
    strategy: Math.round((efficiency + environment) / 2),
    diligence: diligence,
  }
}

// Step 4: 상위 2개 유형 → 유형명
const TYPE_NAMES = {
  leadership: '주도형',
  strategy: '전략형',
  diligence: '노력형',
}

const COMBO_NAMES = {
  'leadership-strategy': '주도적 전략형',
  'leadership-diligence': '주도적 노력형',
  'strategy-diligence': '전략적 노력형',
  'strategy-leadership': '주도적 전략형',
  'diligence-leadership': '주도적 노력형',
  'diligence-strategy': '전략적 노력형',
}

export function calcTypeName(coreIndicators) {
  const sorted = Object.entries(coreIndicators).sort((a, b) => b[1] - a[1])
  const top2 = sorted.slice(0, 2).map(([k]) => k)
  const comboKey = top2.join('-')
  return COMBO_NAMES[comboKey] || TYPE_NAMES[top2[0]] || '노력형'
}

// Step 5: 최저 영역 → 접두어
const GROUP_MAP = {
  selfEfficacy: 'leadership',
  learningWill: 'leadership',
  vision: 'leadership',
  efficiency: 'strategy',
  environment: 'strategy',
  diligence: 'diligence',
}

const PREFIX_TEXT = {
  leadership: {
    B: '주도성이 요구되는',
    C: '주도성이 필요한',
    D: '주도성이 시급한',
    E: '주도성이 시급한',
  },
  strategy: {
    B: '전략 보완이 요구되는',
    C: '전략 재정립이 필요한',
    D: '전략 재구성이 시급한',
    E: '전략 재구성이 시급한',
  },
  diligence: {
    B: '성실성 강화가 요구되는',
    C: '성실 습관 형성이 필요한',
    D: '성실 기반 회복이 시급한',
    E: '성실 기반 회복이 시급한',
  },
}

export function calcPrefix(domainScores) {
  const sorted = Object.entries(domainScores).sort((a, b) => a[1] - b[1])
  const [lowestDomain, lowestScore] = sorted[0]
  const grade = scoreToGrade(lowestScore)

  if (grade === 'A') return ''

  const group = GROUP_MAP[lowestDomain]
  return PREFIX_TEXT[group]?.[grade] ?? ''
}

// Step 6: 최종 유형명
export function calcFinalType(domainScores) {
  const coreIndicators = calcCoreIndicators(domainScores)
  const typeName = calcTypeName(coreIndicators)
  const prefix = calcPrefix(domainScores)
  return prefix ? `${prefix} ${typeName} 학습자` : `${typeName} 학습자`
}

// Step 7: 실천 카드 선택 (하위 3개 영역)
export function selectPracticeCards(domainScores) {
  const sorted = Object.entries(domainScores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([domain]) => domain)

  return sorted.map(domain => practiceCardData[domain]?.[0]).filter(Boolean)
}

// 강점/보완 영역 분류
function getStrengthAndWeakDomains(domainScores) {
  const sorted = DOMAIN_ORDER
    .map(d => ({ domain: d, score: domainScores[d] }))
    .sort((a, b) => b.score - a.score)

  const strengthDomains = sorted.slice(0, 2).map(d => d.domain)
  const weakDomains = sorted.slice(-2).map(d => d.domain)
  return { strengthDomains, weakDomains }
}

// 전체 결과 객체 생성
export function buildResult(answers, studentName = '') {
  const domainScores = calcDomainScores(answers)
  const domainGrades = calcDomainGrades(domainScores)
  const coreIndicators = calcCoreIndicators(domainScores)
  const finalType = calcFinalType(domainScores)
  const selectedCards = selectPracticeCards(domainScores)
  const { strengthDomains, weakDomains } = getStrengthAndWeakDomains(domainScores)

  const sortedByScore = Object.entries(domainScores).sort((a, b) => a[1] - b[1])
  const lowestDomain = sortedByScore[0][0]
  const secondLowestDomain = sortedByScore[1][0]
  const strengthDomain = sortedByScore[sortedByScore.length - 1][0]

  const overallComment = buildOverallComment({
    finalType,
    strengthDomains,
    weakDomains,
    practiceCards: selectedCards,
  })

  const mindCoaching = buildMindCoaching({
    lowestDomain,
    secondLowestDomain,
    strengthDomain,
  })

  const practiceCoaching = buildPracticeCoaching({
    primaryCard: selectedCards[0],
    secondaryCard: selectedCards[1],
  })

  // 영역별 피드백 (등급별)
  const domainFeedbacks = {}
  for (const domain of DOMAIN_ORDER) {
    const grade = domainGrades[domain]
    domainFeedbacks[domain] = feedbackLibrary[domain]?.[grade] || feedbackLibrary[domain]?.['D']
  }

  return {
    studentName,
    domainScores,
    domainGrades,
    coreIndicators,
    finalType,
    strengthDomains,
    weakDomains,
    overallComment,
    mindCoaching,
    practiceCoaching,
    practiceCards: selectedCards,
    domainFeedbacks,
  }
}
