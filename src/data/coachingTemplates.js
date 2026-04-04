import { DOMAIN_LABELS } from './questions'

export function buildOverallComment({ finalType, strengthDomains, weakDomains, practiceCards }) {
  const typeName = finalType.replace(' 학습자', '')
  const taskStr = practiceCards.slice(0, 3).map(c => c.core).join(', ')

  // 모든 영역이 우수한 경우 (강점/보완 구분 없음)
  if (strengthDomains.length === 0 && weakDomains.length === 0) {
    return `현재 학습 상태는 전 영역에서 고르게 높은 수준을 보이고 있으며, ${typeName} 형태로 나타나고 있습니다. 모든 영역에서 안정적인 기반을 갖추고 있어 지금의 흐름을 꾸준히 유지하는 것이 가장 중요합니다.\n\n이미 좋은 습관과 실력을 갖추고 있지만, 더 높은 단계로 나아가기 위해 ${taskStr}를 지속적으로 실천해 보세요. 지금의 균형 잡힌 학습 패턴이 장기적인 성과로 이어질 가능성이 매우 높습니다.`
  }

  const strengthStr = strengthDomains.map(d => DOMAIN_LABELS[d]).join('과 ')
  const weakStr = weakDomains.map(d => DOMAIN_LABELS[d]).join('과 ')

  return `현재 학습 상태는 전반적으로 성장 가능성이 높은 단계에 있으며, 학습의 흐름이 ${typeName} 형태로 나타나고 있습니다. 특히 ${strengthStr}에서는 안정적인 기반을 갖추고 있어, 올바른 방향이 잡히면 성과로 빠르게 연결될 수 있는 상태입니다.\n\n반면 ${weakStr}에서는 학습의 효율과 지속성이 제한될 가능성이 있습니다. 이 부분은 단순한 의지의 문제가 아니라, 학습 구조와 실행 방식의 개선이 필요한 단계입니다.\n\n앞으로는 ${weakStr}을 중심으로 학습을 재구성해야 합니다. 특히 ${taskStr}를 꾸준히 실천하면 학습의 흐름이 안정되고 성과로 이어질 가능성이 매우 높습니다.`
}

export function buildMindCoaching({ lowestDomain, secondLowestDomain, strengthDomain, allSameScore }) {
  // 모든 영역이 동일한 점수(만점 포함)인 경우
  if (allSameScore) {
    return `모든 영역에서 균형 잡힌 학습 태도를 갖추고 있는 상태입니다. 자아효능감, 학습의지, 효율성, 성실성, 학습환경, 비전 모두 안정적으로 유지되고 있어요. 앞으로는 지금의 흐름을 유지하면서 더 높은 목표를 향해 나아가는 것이 중요합니다. 이미 좋은 기반이 갖춰져 있으니, 과정을 즐기며 성장해 나가세요.`
  }

  const lowest = DOMAIN_LABELS[lowestDomain] || lowestDomain
  const second = DOMAIN_LABELS[secondLowestDomain] || secondLowestDomain
  const strength = DOMAIN_LABELS[strengthDomain] || strengthDomain

  return `지금 상태는 ${lowest}의 부분에서 조금 더 성장할 여지가 있는 단계입니다. 특히 ${second}도 함께 점검하면 전반적인 학습 흐름이 더욱 안정될 수 있습니다. 현재의 탁월한 강점인 ${strength}을 기반으로 충분히 빠르고 쉽게 성장이 가능한 상태입니다. 앞으로는 단기적인 결과보다 과정과 기준을 중심으로 학습을 점검하고 스스로를 바라보는 태도를 만들어야 합니다.`
}

export function buildPracticeCoaching({ primaryCard, secondaryCard }) {
  const primaryTask = primaryCard?.core || '핵심 실천 과제'
  const secondaryTask = secondaryCard?.core || '추가 실천 과제'

  return `지금 시점에서는 너무 많은 것을 한 번에 바꾸려 하기보다, 가장 핵심적이고 구체적인 한 가지 행동부터 안정시키는 것이 중요합니다. 특히 "${primaryTask}"를 먼저 단단히 실천하시면 전체 학습 흐름이 긍정적으로 달라질 수 있습니다. 이 과정을 반복하면서 추가적으로 "${secondaryTask}"까지 연결한다면 학습의 안정성이 크게 높아집니다. 앞으로는 하루 단위의 아주 작은 실천을 기준으로 꾸준히 반복하는 것이 가장 핵심적인 전략입니다.`
}
