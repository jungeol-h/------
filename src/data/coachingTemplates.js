import { DOMAIN_LABELS } from './questions'
import { withEulReul, withEunNeun } from '../utils/koreanUtils'

// 전체 상태 표현 (문장 1용)
function getStateDescription(strengthDomains, weakDomains) {
  if (strengthDomains.length === 0 && weakDomains.length === 0) {
    return '전반적인 학습 태도'
  }
  if (weakDomains.length === 0) {
    return '학습에 필요한 여러 요소'
  }
  return '학습 의지와 태도'
}

// 강점 표현 (문장 2용)
function getStrengthSentence(strengthDomains) {
  if (strengthDomains.length === 0) {
    return '꾸준히 노력하려는 자세는 좋은 강점입니다.'
  }
  const labels = strengthDomains.map(d => DOMAIN_LABELS[d])
  const last = labels[labels.length - 1]
  // 마지막 항목에 조사 붙임, 나머지는 그대로 연결
  const allWithParticle = labels.slice(0, -1).join(', ')
  const withParticle = withEunNeun(last)
  const domainStr = allWithParticle ? `${allWithParticle}, ${withParticle}` : withParticle
  return `특히 ${domainStr} 좋은 강점입니다.`
}

// 보완 표현 (문장 3용)
function getWeakSentence(weakDomains, supplements) {
  // supplements가 있으면 우선 사용
  if (supplements && supplements.length > 0) {
    const parts = supplements.map(s => s.domainLabel)
    const last = parts[parts.length - 1]
    const allWithParticle = parts.slice(0, -1).join(', ')
    const withParticle = withEunNeun(last)
    const domainStr = allWithParticle ? `${allWithParticle}, ${withParticle}` : withParticle
    return `다만 ${domainStr} 더 보완이 필요합니다.`
  }
  if (weakDomains.length === 0) {
    return '다만 현재 수준을 꾸준히 유지하는 것이 필요합니다.'
  }
  const labels = weakDomains.map(d => DOMAIN_LABELS[d])
  const last = labels[labels.length - 1]
  const allWithParticle = labels.slice(0, -1).join(', ')
  const withParticle = withEunNeun(last)
  const domainStr = allWithParticle ? `${allWithParticle}, ${withParticle}` : withParticle
  return `다만 ${domainStr} 더 보완이 필요합니다.`
}

// 실천 방향 표현 (문장 4용)
function getActionSentence(supplements, practiceCards) {
  if (supplements && supplements.length > 0) {
    const domain = supplements[0].domainLabel
    return `앞으로는 ${withEulReul(domain)} 개선하는 데 집중하면 좋겠습니다.`
  }
  if (practiceCards && practiceCards.length > 0 && practiceCards[0]?.title) {
    return `앞으로는 ${withEulReul(practiceCards[0].title)} 꾸준히 실천하면 좋겠습니다.`
  }
  return '앞으로는 매일 작은 실천을 꾸준히 이어가면 좋겠습니다.'
}

export function buildOverallComment({ finalType, strengthDomains, weakDomains, supplements, practiceCards }) {
  const stateDesc = getStateDescription(strengthDomains, weakDomains)

  const s1 = `지금은 ${stateDesc}이 어느 정도 갖춰진 상태입니다.`
  const s2 = getStrengthSentence(strengthDomains)
  const s3 = getWeakSentence(weakDomains, supplements)
  const s4 = getActionSentence(supplements, practiceCards)

  return `${s1} ${s2} ${s3} ${s4}`
}

// PDF 결과지용 총평 요약 (4문장 동일 구조)
export function buildOverallSummary({ finalType, strengthDomains, weakDomains, supplements }) {
  const stateDesc = getStateDescription(strengthDomains, weakDomains)

  const s1 = `지금은 ${stateDesc}이 어느 정도 갖춰진 상태입니다.`
  const s2 = getStrengthSentence(strengthDomains)
  const s3 = getWeakSentence(weakDomains, supplements)
  const s4 = supplements && supplements.length > 0
    ? `앞으로는 ${withEulReul(supplements[0].domainLabel)} 집중적으로 보완하면 좋겠습니다.`
    : '앞으로는 매일 작은 실천을 꾸준히 이어가면 좋겠습니다.'

  return `${s1} ${s2} ${s3} ${s4}`
}

// PDF 결과지용 마인드 코칭 요약 (1~2줄)
export function buildMindSummary({ lowestDomain, secondLowestDomain, strengthDomain, allSameScore }) {
  if (allSameScore) {
    return '균형 잡힌 학습 태도가 잘 갖춰져 있습니다. 지금의 흐름을 유지하며 과정을 즐기세요.'
  }

  const lowest = DOMAIN_LABELS[lowestDomain] || lowestDomain
  const strength = DOMAIN_LABELS[strengthDomain] || strengthDomain

  return `${lowest} 영역에서 성장 여지가 있으며, ${strength}의 강점을 살려 빠른 성장이 가능합니다. 과정과 기준을 중심으로 학습을 점검해 보세요.`
}

// PDF 결과지용 실천 코칭 요약 (1~2줄)
export function buildPracticeSummary({ primaryCard, secondaryCard }) {
  const primaryTask = primaryCard?.title || '핵심 과제'
  const secondaryTask = secondaryCard?.title || '추가 과제'

  return `"${primaryTask}"부터 안정시킨 뒤, "${secondaryTask}"까지 연결하세요. 하루 단위의 작은 실천을 꾸준히 반복하는 것이 핵심입니다.`
}

export function buildMindCoaching({ lowestDomain, secondLowestDomain, strengthDomain, allSameScore }) {
  // 모든 영역이 동일한 점수(만점 포함)인 경우
  if (allSameScore) {
    return `모든 영역에서 균형 잡힌 학습 태도를 갖추고 있는 상태입니다. 자아효능감, 학습의지, 효율성, 성실성, 학습환경, 비전 모두 안정적으로 유지되고 있어요. 앞으로는 지금의 흐름을 유지하면서 더 높은 목표를 향해 나아가는 것이 중요합니다. 이미 좋은 습관이 갖춰져 있으니, 과정을 즐기며 성장해 나가세요.`
  }

  const lowest = DOMAIN_LABELS[lowestDomain] || lowestDomain
  const second = DOMAIN_LABELS[secondLowestDomain] || secondLowestDomain
  const strength = DOMAIN_LABELS[strengthDomain] || strengthDomain

  return `지금 상태는 ${lowest}에서 조금 더 성장할 여지가 있는 단계입니다. 특히 ${second}도 함께 점검하면 전반적인 학습 습관이 더욱 안정될 수 있습니다. 현재의 탁월한 강점인 ${strength}을 살려 충분히 빠르고 쉽게 성장이 가능한 상태입니다. 앞으로는 단기적인 결과보다 과정과 기준을 중심으로 학습을 점검하고 스스로를 바라보는 태도를 만들어야 합니다.`
}

export function buildPracticeCoaching({ primaryCard, secondaryCard }) {
  const primaryTask = primaryCard?.core || '핵심 실천 과제'
  const secondaryTask = secondaryCard?.core || '추가 실천 과제'

  return `지금 시점에서는 너무 많은 것을 한 번에 바꾸려 하기보다, 가장 핵심적이고 구체적인 한 가지 행동부터 안정시키는 것이 중요합니다. 특히 "${withEulReul(primaryTask)}" 먼저 단단히 실천하면 전체 학습 습관이 긍정적으로 달라질 수 있습니다. 이 과정을 반복하면서 추가적으로 "${secondaryTask}"까지 연결한다면 학습 습관의 안정이 크게 높아집니다. 앞으로는 하루 단위의 아주 작은 실천을 기준으로 꾸준히 반복하는 것이 가장 핵심적인 전략입니다.`
}
