import { questions, DOMAIN_ORDER, DOMAIN_LABELS } from '../data/questions'
import { feedbackLibrary, practiceCards as practiceCardData } from '../data/feedbackLibrary'
import { buildOverallComment, buildOverallSummary, buildMindCoaching, buildMindSummary, buildPracticeCoaching, buildPracticeSummary } from '../data/coachingTemplates'

const CORE_LABELS = {
  leadership: '주도형',
  strategy: '전략형',
  diligence: '노력형',
}

function translateKeys(obj, labelMap) {
  if (!obj) return {}
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const newKey = labelMap[key] || key
    result[newKey] = value
  }
  return result
}

function translateArray(arr, labelMap) {
  if (!arr) return []
  return arr.map(item => labelMap[item] || item)
}

// Step 1: answers 배열 → 영역별 점수 (100점 환산)
// shuffledQuestions: 셔플된 문항 배열 (originalIndex 포함) — 없으면 순서대로 처리
export function calcDomainScores(answers, shuffledQuestions) {
  const domainAnswers = {}
  const orderedQuestions = shuffledQuestions || questions.map((q, idx) => ({ ...q, originalIndex: idx }))

  orderedQuestions.forEach((q, shuffleIdx) => {
    const domain = q.domain
    if (!domainAnswers[domain]) domainAnswers[domain] = []
    const value = answers[shuffleIdx] || 3
    domainAnswers[domain].push(value)
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

// 등급 → 5점 환산
const GRADE_TO_POINT = { A: 5, B: 4, C: 3, D: 2, E: 1 }
function gradeToPoint(grade) {
  return GRADE_TO_POINT[grade] || 1
}

// Step 3: 3개 그룹 점수 (등급 기반 5점 환산)
export function calcCoreIndicators(domainGrades) {
  const { selfEfficacy, learningWill, vision, efficiency, environment, diligence } = domainGrades
  return {
    leadership: Math.round(((gradeToPoint(selfEfficacy) + gradeToPoint(learningWill) + gradeToPoint(vision)) / 3) * 100) / 100,
    strategy: Math.round(((gradeToPoint(efficiency) + gradeToPoint(environment)) / 2) * 100) / 100,
    diligence: gradeToPoint(diligence),
  }
}

// Step 4: 상위 2개 유형 → 유형명 (6개 유형)
const TYPE_MAP = {
  'leadership': '주도형 학습자',
  'strategy': '전략형 학습자',
  'diligence': '노력형 학습자',
  'leadership-strategy': '주도·전략형 학습자',
  'leadership-diligence': '주도·노력형 학습자',
  'strategy-diligence': '전략·노력형 학습자',
}

// 동점 시 우선순위: leadership > strategy > diligence
const TIE_ORDER = ['leadership', 'strategy', 'diligence']

export function calcTypeName(coreIndicators) {
  // 내림차순 정렬 (동점 시 TIE_ORDER 우선순위 적용)
  const sorted = Object.entries(coreIndicators).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return TIE_ORDER.indexOf(a[0]) - TIE_ORDER.indexOf(b[0])
  })

  const [top1Key, top1Val] = sorted[0]
  const [top2Key, top2Val] = sorted[1]
  const [top3Key, top3Val] = sorted[2]

  // 3개 모두 동점
  if (top1Val === top2Val && top2Val === top3Val) {
    return TYPE_MAP['leadership-strategy']
  }

  // 상위 2개 동점
  if (top1Val === top2Val) {
    const key = [top1Key, top2Key].sort((a, b) => TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b)).join('-')
    return TYPE_MAP[key] || TYPE_MAP[top1Key]
  }

  // 단독 1위 → 2위와 점수 차이가 0.34 이내면 콤보 (5점 척도에서 1점 차이의 1/3)
  const diff = top1Val - top2Val
  if (diff <= 0.34) {
    const key = [top1Key, top2Key].sort((a, b) => TIE_ORDER.indexOf(a) - TIE_ORDER.indexOf(b)).join('-')
    return TYPE_MAP[key] || TYPE_MAP[top1Key]
  }

  return TYPE_MAP[top1Key] || '주도형 학습자'
}

// Step 5: 최종 유형명 (접두어 없음)
export function calcFinalType(domainGrades) {
  const coreIndicators = calcCoreIndicators(domainGrades)
  return calcTypeName(coreIndicators)
}

// Step 6: 보완점 생성 (가장 낮은 영역 1~2개)
const SUPPLEMENT_EXPRESSIONS = {
  B: '강화 필요',
  C: '보완 필요',
  D: '집중 개선 필요',
  E: '집중 개선 필요',
}

export function calcSupplements(domainGrades) {
  const sorted = DOMAIN_ORDER
    .map(d => ({ domain: d, grade: domainGrades[d], point: gradeToPoint(domainGrades[d]) }))
    .sort((a, b) => a.point - b.point)

  const results = []
  const lowestPoint = sorted[0].point

  // A등급(point=5)은 보완 없음
  if (lowestPoint === 5) return []

  for (const item of sorted) {
    if (item.point === 5) break // A등급 이상은 제외
    if (results.length >= 2) break
    // 첫 번째는 무조건 추가, 두 번째는 같은 점수이거나 B/C/D/E 등급일 때만
    if (results.length === 0 || item.point <= lowestPoint + 0) {
      const expression = SUPPLEMENT_EXPRESSIONS[item.grade] || '보완 필요'
      results.push({
        domain: item.domain,
        domainLabel: DOMAIN_LABELS[item.domain],
        grade: item.grade,
        expression,
        formatted: `${DOMAIN_LABELS[item.domain]} ${expression}`,
      })
    }
  }

  return results
}

// Step 7: 실천 카드 선택 (보완 영역 2개 + 종합 1개)
export function selectPracticeCards(domainScores, domainGrades, cardData) {
  const grades = domainGrades || calcDomainGrades(domainScores)
  const cards_db = cardData || practiceCardData

  // 보완 영역 (A 제외, 낮은 순)
  const sortedDomains = DOMAIN_ORDER
    .map(d => ({ domain: d, point: gradeToPoint(grades[d]) }))
    .sort((a, b) => a.point - b.point)
    .filter(d => d.point < 5) // A등급 제외
    .map(d => d.domain)

  const cards = []

  // 세트 1, 2: 보완 영역 상위 2개
  const topTwo = sortedDomains.slice(0, 2)
  for (const domain of topTwo) {
    const card = cards_db[domain]?.[0]
    if (card) cards.push(card)
  }

  // 보완 영역이 1개뿐이라면 두 번째 낮은 영역(A포함)에서 추가
  if (cards.length < 2) {
    const allSorted = DOMAIN_ORDER
      .map(d => ({ domain: d, score: domainScores[d] }))
      .sort((a, b) => a.score - b.score)
      .map(d => d.domain)
    for (const domain of allSorted) {
      if (!topTwo.includes(domain)) {
        const card = cards_db[domain]?.[0]
        if (card) { cards.push(card); break }
      }
    }
  }

  // 세트 3: 종합 학습 향상 카드
  const overallCard = cards_db['overall']?.[0]
  if (overallCard) cards.push(overallCard)

  return cards
}

// 강점/보완 영역 분류 (동점이면 강점/보완 없음)
function getStrengthAndWeakDomains(domainScores) {
  const sorted = DOMAIN_ORDER
    .map(d => ({ domain: d, score: domainScores[d] }))
    .sort((a, b) => b.score - a.score)

  const maxScore = sorted[0].score
  const minScore = sorted[sorted.length - 1].score

  if (maxScore === minScore) {
    return { strengthDomains: [], weakDomains: [] }
  }

  const strengthDomains = sorted.filter(d => d.score === maxScore).map(d => d.domain).slice(0, 2)
  const weakDomains = sorted
    .filter(d => d.score === minScore && !strengthDomains.includes(d.domain))
    .map(d => d.domain)
    .slice(0, 2)

  return { strengthDomains, weakDomains }
}

// 전체 결과 객체 생성
// config: { feedbackLibrary, practiceCards } — AdminConfigContext에서 주입, 없으면 기본값
export function buildResult(answers, studentName = '', shuffledQuestions = null, config = null) {
  const resolvedFeedbackLib = config?.feedbackLibrary || feedbackLibrary
  const resolvedPracticeCards = config?.practiceCards || practiceCardData

  const domainScores = calcDomainScores(answers, shuffledQuestions)
  const domainGrades = calcDomainGrades(domainScores)
  const coreIndicators = calcCoreIndicators(domainGrades)
  const finalType = calcFinalType(domainGrades)
  const supplements = calcSupplements(domainGrades)
  const selectedCards = selectPracticeCards(domainScores, domainGrades, resolvedPracticeCards)
  const { strengthDomains, weakDomains } = getStrengthAndWeakDomains(domainScores)

  const sortedByScore = Object.entries(domainScores).sort((a, b) => a[1] - b[1])
  const lowestDomain = sortedByScore[0][0]
  const lowestScore = sortedByScore[0][1]
  const secondLowestDomain = sortedByScore[1][0]
  const strengthDomain = sortedByScore[sortedByScore.length - 1][0]
  const allSameScore = sortedByScore.every(([, s]) => s === lowestScore)

  const overallComment = buildOverallComment({
    finalType,
    strengthDomains,
    weakDomains,
    supplements,
    practiceCards: selectedCards,
  })

  const overallSummary = buildOverallSummary({
    finalType,
    strengthDomains,
    weakDomains,
    supplements,
  })

  const mindCoaching = buildMindCoaching({
    lowestDomain,
    secondLowestDomain,
    strengthDomain,
    allSameScore,
  })

  const mindSummary = buildMindSummary({
    lowestDomain,
    secondLowestDomain,
    strengthDomain,
    allSameScore,
  })

  const practiceCoaching = buildPracticeCoaching({
    primaryCard: selectedCards[0],
    secondaryCard: selectedCards[1],
  })

  const practiceSummary = buildPracticeSummary({
    primaryCard: selectedCards[0],
    secondaryCard: selectedCards[1],
  })

  const domainFeedbacks = {}
  for (const domain of DOMAIN_ORDER) {
    const grade = domainGrades[domain]
    domainFeedbacks[domain] = resolvedFeedbackLib[domain]?.[grade] || resolvedFeedbackLib[domain]?.['D']
  }

  return {
    studentName,
    domainScores,
    koreanDomainScores: translateKeys(domainScores, DOMAIN_LABELS),
    domainGrades,
    koreanDomainGrades: translateKeys(domainGrades, DOMAIN_LABELS),
    coreIndicators,
    koreanCoreIndicators: translateKeys(coreIndicators, CORE_LABELS),
    finalType,
    strengthDomains,
    koreanStrengthDomains: translateArray(strengthDomains, DOMAIN_LABELS),
    weakDomains,
    koreanWeakDomains: translateArray(weakDomains, DOMAIN_LABELS),
    supplements,
    overallComment,
    overallSummary,
    mindCoaching,
    mindSummary,
    practiceCoaching,
    practiceSummary,
    practiceCards: selectedCards,
    domainFeedbacks,
  }
}
