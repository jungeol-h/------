import { questions } from '../../legacy/data/questions.js'
import { stageFeedbackLibrary, STAGE_META, STAGE_ORDER, STAGE_TASKS } from '../data/stageFeedbackLibrary.js'

// answers 배열(30개) → 6개 영역별 점수(0~100)
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

// 점수(0~100) → A~E 등급
export function scoreToGrade(score) {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'E'
}

// 6개 영역 점수 → 4단계 점수 계산
// 기초: (selfEfficacy + learningWill) / 2
// 정리: efficiency
// 적용: diligence
// 확장: vision
// 학습환경(environment)은 단계 매핑에서 제외
export function calcStageScores(domainScores) {
  return {
    basic:    Math.round((domainScores.selfEfficacy + domainScores.learningWill) / 2),
    organize: domainScores.efficiency,
    apply:    domainScores.diligence,
    expand:   domainScores.vision,
  }
}

// 4단계 점수 → A~E 등급
export function calcStageGrades(stageScores) {
  const grades = {}
  for (const stage of STAGE_ORDER) {
    grades[stage] = scoreToGrade(stageScores[stage])
  }
  return grades
}

const GRADE_POINT = { A: 5, B: 4, C: 3, D: 2, E: 1 }

// 강점 2개(상위), 약점 1~2개(하위) 추출
export function getStageStatus(stageGrades) {
  const sorted = STAGE_ORDER
    .map(s => ({ stage: s, point: GRADE_POINT[stageGrades[s]] || 1 }))
    .sort((a, b) => b.point - a.point)

  const strongStages = sorted.slice(0, 2).map(s => s.stage)
  const weakStages = sorted.slice(-2).reverse()
    .filter(s => (GRADE_POINT[stageGrades[s.stage]] || 1) <= 3)
    .map(s => s.stage)

  return { strongStages, weakStages }
}

// 상태 유형 분류
export function getStateType(stageGrades) {
  const types = []
  if (['D', 'E'].includes(stageGrades.basic))    types.push('이해 부족형')
  if (['D', 'E'].includes(stageGrades.organize)) types.push('비효율 학습형')
  if (['D', 'E'].includes(stageGrades.apply))    types.push('실행 부족형')
  if (['D', 'E'].includes(stageGrades.expand))   types.push('심화 부족형')
  if (types.length === 0) types.push('균형 성장형')
  return types
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// 4문단 코칭 리포트 생성
// ① 현재 상태 ② 강점 ③ 문제 원인 ④ 개선 방향
export function buildCoachingReport(stageGrades, stageStatus) {
  const { strongStages, weakStages } = stageStatus

  const weakStage = weakStages[0] || null
  const strongStage = strongStages[0] || null

  // ① 현재 상태: 가장 약한 단계의 weak 문장
  const currentState = weakStage
    ? pickRandom(stageFeedbackLibrary[weakStage].weak)
    : '현재 학생은 전반적으로 균형 잡힌 학습 역량을 갖추고 있습니다.'

  // ② 강점: 가장 강한 단계의 strong 문장
  const strength = strongStage
    ? pickRandom(stageFeedbackLibrary[strongStage].strong)
    : '전 영역에서 고른 강점을 보이고 있습니다.'

  // ③ 문제 원인: 두 번째 약한 단계가 있으면 추가, 없으면 첫 번째 약한 단계 다른 문장
  const secondWeak = weakStages[1] || weakStage
  const problemCause = secondWeak
    ? pickRandom(stageFeedbackLibrary[secondWeak].weak)
    : '추가적인 보완 영역 없이 현재 상태를 유지하면 됩니다.'

  // ④ 개선 방향: 강한 단계의 strong 중 다른 문장
  const improvementPool = strongStage
    ? stageFeedbackLibrary[strongStage].strong
    : stageFeedbackLibrary.basic.strong
  let improvement = pickRandom(improvementPool)
  // 강점 문장과 다르게 시도 (최대 3번)
  for (let i = 0; i < 3 && improvement === strength; i++) {
    improvement = pickRandom(improvementPool)
  }
  // 개선 방향은 약한 단계 해결로 전환
  if (weakStage) {
    const label = STAGE_META[weakStage].label
    improvement = `${STAGE_META[weakStage]?.label} 단계를 보완하기 위해 ${STAGE_TASKS[weakStage].join(', ')} 등을 꾸준히 실천하는 것을 권장합니다. ${strongStage ? `이미 갖춰진 ${STAGE_META[strongStage].label} 단계의 강점을 활용하면 더 빠른 성장이 가능합니다.` : ''}`
  }

  return { currentState, strength, problemCause, improvement }
}

// 약점 단계 기준 실행 과제 3개 자동 선택
export function selectTasks(stageGrades) {
  const sorted = STAGE_ORDER
    .map(s => ({ stage: s, point: GRADE_POINT[stageGrades[s]] || 1 }))
    .sort((a, b) => a.point - b.point)

  const tasks = []
  for (const { stage } of sorted) {
    for (const task of STAGE_TASKS[stage]) {
      if (tasks.length >= 3) break
      tasks.push({ stage, label: STAGE_META[stage].label, task })
    }
    if (tasks.length >= 3) break
  }
  return tasks
}

// 학습자 유형명 생성 (가장 높은 단계 기반)
export function getTypeName(stageGrades) {
  const sorted = STAGE_ORDER
    .map(s => ({ stage: s, point: GRADE_POINT[stageGrades[s]] || 1 }))
    .sort((a, b) => b.point - a.point)

  const top = sorted[0]
  const second = sorted[1]

  const TYPE_NAMES = {
    basic:    '기초 완성 단계',
    organize: '정리 강점 단계',
    apply:    '실행 중심 단계',
    expand:   '비전 주도 단계',
  }

  if (top.point - second.point <= 1 && top.point >= 3) {
    return `${STAGE_META[top.stage].label}·${STAGE_META[second.stage].label} 균형형`
  }
  return TYPE_NAMES[top.stage] || '성장 진행형'
}
