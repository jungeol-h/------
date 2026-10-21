// 내신 시험 키(학년도·학기·중간/기말) 용어·기본값 헬퍼 — 내신백서 전반이 공유한다.
// 학년도: 3월 시작. 1~2월은 직전 학년도 2학기 기말 시험 기간으로 본다.

import { todayStr } from './dateUtils.js'

export const EXAM_TYPES = [
  { key: 'mid', label: '중간' },
  { key: 'final', label: '기말' },
]

export function examKeyLabel({ examYear, semester, examType }) {
  const type = EXAM_TYPES.find((t) => t.key === examType)?.label ?? examType
  return `${examYear}학년도 ${semester}학기 ${type}`
}

export function sameExamKey(a, b) {
  return !!a && !!b
    && Number(a.examYear) === Number(b.examYear)
    && Number(a.semester) === Number(b.semester)
    && a.examType === b.examType
}

// 'YYYY-MM-DD' → 그 시점에 가장 가까운 시험 키
export function defaultExamKey(dateStr = todayStr()) {
  const year = Number(dateStr.slice(0, 4))
  const month = Number(dateStr.slice(5, 7))
  if (month <= 2) return { examYear: year - 1, semester: 2, examType: 'final' }
  if (month <= 5) return { examYear: year, semester: 1, examType: 'mid' }
  if (month <= 7) return { examYear: year, semester: 1, examType: 'final' }
  if (month <= 10) return { examYear: year, semester: 2, examType: 'mid' }
  return { examYear: year, semester: 2, examType: 'final' }
}

const ORDER = [
  { semester: 1, examType: 'mid' },
  { semester: 1, examType: 'final' },
  { semester: 2, examType: 'mid' },
  { semester: 2, examType: 'final' },
]

// 기준 키부터 과거로 count개, 최신순 (선택지용)
export function examKeyOptions(dateStr = todayStr(), count = 6) {
  const base = defaultExamKey(dateStr)
  let idx = ORDER.findIndex((o) => o.semester === base.semester && o.examType === base.examType)
  let year = base.examYear
  const out = []
  for (let i = 0; i < count; i++) {
    out.push({ examYear: year, ...ORDER[idx] })
    idx -= 1
    if (idx < 0) { idx = ORDER.length - 1; year -= 1 }
  }
  return out
}

// 학교명 정규화 — 학생 명단에 '경덕중'·'경덕중학교'가 섞여 있어 시험지 분석 키(학교·학년·과목·시험)가
// 갈라지지 않도록 저장·필터·추천 모두 짧은 표기로 맞춘다. ('경안여중'처럼 이미 짧은 표기는 그대로)
export function normalizeSchool(name) {
  return (name ?? '')
    .replace(/\s+/g, '')
    .replace(/초등학교$/, '초')
    .replace(/중학교$/, '중')
    .replace(/고등학교$/, '고')
}
