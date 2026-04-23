import { createContext, useContext, useReducer, useEffect } from 'react'
import { buildResult } from '../utils/scoreCalculator'
import { TOTAL_QUESTIONS, createShuffledQuestions } from '../data/questions'

const DiagnosisContext = createContext(null)

const SESSION_KEY = 'diagnosis_state'

function loadFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveToSession(state) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(state)) }
  catch {}
}

function createInitialState() {
  return {
    // 개인정보
    studentName: '',
    school: '',
    grade: '',
    studentPhone: '',
    parentPhone: '',
    agreed: false,
    // 사전설문
    preSurvey: {
      '가장 어려운 과목': '',
      'MBTI': '',
      '학습 성취도 수준': '',
      '상담 및 코칭 희망 내용': '',
      '희망 진로 및 관심 분야': '',
    },
    // 진단 문항
    answers: new Array(TOTAL_QUESTIONS).fill(0), // 0 = 미선택
    shuffledQuestions: createShuffledQuestions(),
    currentIndex: 0,
    isCompleted: false,
    result: null,
  }
}

const initialState = loadFromSession() ?? createInitialState()

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PERSONAL_INFO':
      return { ...state, ...action.payload }

    case 'SET_PRE_SURVEY':
      return { ...state, preSurvey: { ...state.preSurvey, ...action.payload } }

    case 'SET_NAME':
      return { ...state, studentName: action.payload }

    case 'SET_ANSWER': {
      const newAnswers = [...state.answers]
      newAnswers[action.index] = action.value
      return { ...state, answers: newAnswers }
    }

    case 'SET_ANSWERS':
      return { ...state, answers: action.payload }

    case 'SET_SURVEY_RESULT':
      return { ...state, answers: action.payload.answers, result: action.payload.result, isCompleted: true }

    case 'NEXT_QUESTION': {
      const nextIndex = state.currentIndex + 1
      if (nextIndex >= TOTAL_QUESTIONS) {
        // action.config: AdminConfigContext에서 주입된 커스텀 설정 (없으면 기본값)
        const result = buildResult(state.answers, state.studentName, state.shuffledQuestions, action.config ?? null)
        return { ...state, currentIndex: nextIndex, isCompleted: true, result }
      }
      return { ...state, currentIndex: nextIndex }
    }

    case 'PREV_QUESTION':
      return { ...state, currentIndex: Math.max(0, state.currentIndex - 1) }

    case 'RESET': {
      const fresh = createInitialState()
      return fresh
    }

    default:
      return state
  }
}

export function DiagnosisProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (!state.studentName && !state.result) {
      sessionStorage.removeItem(SESSION_KEY)
    } else {
      saveToSession(state)
    }
  }, [state])

  return (
    <DiagnosisContext.Provider value={{ state, dispatch }}>
      {children}
    </DiagnosisContext.Provider>
  )
}

export function useDiagnosis() {
  const context = useContext(DiagnosisContext)
  if (!context) throw new Error('DiagnosisProvider 내부에서만 사용 가능')
  return context
}
