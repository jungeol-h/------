export const DOMAINS = {
  SELF_EFFICACY: 'selfEfficacy',
  LEARNING_WILL: 'learningWill',
  EFFICIENCY: 'efficiency',
  DILIGENCE: 'diligence',
  ENVIRONMENT: 'environment',
  VISION: 'vision',
}

export const DOMAIN_LABELS = {
  selfEfficacy: '자아효능감',
  learningWill: '학습의지',
  efficiency: '효율성',
  diligence: '성실성',
  environment: '학습환경',
  vision: '비전',
}

export const DOMAIN_COLORS = {
  selfEfficacy: '#7C3AED',
  learningWill: '#6D28D9',
  efficiency: '#9333EA',
  diligence: '#8B5CF6',
  environment: '#A855F7',
  vision: '#C084FC',
}

export const DOMAIN_ORDER = [
  'selfEfficacy',
  'learningWill',
  'efficiency',
  'diligence',
  'environment',
  'vision',
]

export const LIKERT_LABELS = ['전혀 아니다', '아니다', '보통이다', '그렇다', '매우 그렇다']

// 총 30문항 (각 영역 5문항)
export const questions = [
  // 자아효능감 (5문항)
  { id: 1, domain: 'selfEfficacy', text: '나는 공부를 하면 결과가 좋아질 수 있다고 믿는다' },
  { id: 2, domain: 'selfEfficacy', text: '나는 어려운 문제를 풀기 위해 여러 번 반복하는 편이다' },
  { id: 3, domain: 'selfEfficacy', text: '나는 시험 성적은 항상 내가 공부한 만큼의 결과라고 생각한다' },
  { id: 4, domain: 'selfEfficacy', text: '나는 어떤 과목이든 노력하면 잘할 수 있다고 믿는다' },
  { id: 5, domain: 'selfEfficacy', text: '나는 살면서 어려운 일이 있어도 결국 해낼 수 있다고 생각한다' },

  // 학습의지 (5문항)
  { id: 6, domain: 'learningWill', text: '나는 해야 할 공부를 미루지 않고 시작하려고 한다' },
  { id: 7, domain: 'learningWill', text: '나는 공부가 하기 싫을 때도 이겨 내려고 노력한다' },
  { id: 8, domain: 'learningWill', text: '나는 목표를 세우면 끝까지 해내려고 한다' },
  { id: 9, domain: 'learningWill', text: '나는 모르거나 어려운 공부도 포기하지 않고 해내려고 노력한다' },
  { id: 10, domain: 'learningWill', text: '나는 결과가 안 좋더라도 다음을 기대하고 노력한다' },

  // 효율성 (5문항)
  { id: 11, domain: 'efficiency', text: '나는 공부할 때 중요한 내용과 덜 중요한 내용을 구분한다' },
  { id: 12, domain: 'efficiency', text: '나는 틀린 문제는 틀린 이유와 정답의 근거를 반드시 확인한다' },
  { id: 13, domain: 'efficiency', text: '나는 수업 후 배운 내용을 요약 정리하고 복습한다' },
  { id: 14, domain: 'efficiency', text: '나는 암기나 문제 풀이를 할 때 시간을 재면서 한다' },
  { id: 15, domain: 'efficiency', text: '나는 나에게 맞는 학습방법을 찾기 위해 시도하고 활용한다' },

  // 성실성 (5문항)
  { id: 16, domain: 'diligence', text: '나는 주어진 과제는 빠짐없이 모두 수행한다' },
  { id: 17, domain: 'diligence', text: '나는 매일 공부 시간을 정해 놓고 지키려고 한다' },
  { id: 18, domain: 'diligence', text: '나는 매일 공부할 내용을 정하고 실천하려고 한다' },
  { id: 19, domain: 'diligence', text: '나는 계획을 세우고 그대로 실천하는 편이다' },
  { id: 20, domain: 'diligence', text: '나는 매일 꾸준히 공부하는 습관이 있다' },

  // 학습환경 (5문항)
  { id: 21, domain: 'environment', text: '나는 공부할 때 방해되는 것(핸드폰 등)을 줄이려고 한다' },
  { id: 22, domain: 'environment', text: '나는 집중이 잘 되는 장소에서 공부하려고 한다' },
  { id: 23, domain: 'environment', text: '나는 공부 전에 주변을 정리하고 시작한다' },
  { id: 24, domain: 'environment', text: '나는 공부할 때 다른 행동이나 생각을 줄이려고 한다' },
  { id: 25, domain: 'environment', text: '나는 필요한 학습 도구(문구나 앱 등)를 잘 갖추고 있다' },

  // 비전 (5문항)
  { id: 26, domain: 'vision', text: '나는 내가 왜 공부해야 하는지 알고 있다' },
  { id: 27, domain: 'vision', text: '나는 앞으로 하고 싶은 일이나 목표가 있다' },
  { id: 28, domain: 'vision', text: '나는 목표를 이루기 위해 지금 공부가 필요하다고 생각한다' },
  { id: 29, domain: 'vision', text: '나는 구체적인 진로 목표와 진학 목표가 있다' },
  { id: 30, domain: 'vision', text: '나는 진로 목표를 이루기 위해 지금 해야 할 공부를 계획한다' },
]

export const TOTAL_QUESTIONS = questions.length

// 문항을 무작위로 섞되, shuffleIndex를 부여하여 answers 배열 매핑에 활용
export function createShuffledQuestions() {
  const shuffled = questions.map((q, idx) => ({ ...q, originalIndex: idx }))
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
