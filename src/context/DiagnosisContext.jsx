import { createContext, useContext, useReducer } from 'react'
import { buildResult } from '../utils/scoreCalculator'
import { TOTAL_QUESTIONS, createShuffledQuestions } from '../data/questions'

const DiagnosisContext = createContext(null)

function createInitialState() {
  return {
    // 개인정보
    studentName: '',
    school: '',
    grade: '',
    studentPhone: '',
    parentPhone: '',
    // 사전설문
    preSurvey: {
      hardestSubject: '',
      mbti: '',
      gradeLevel: '',
      counselingTopic: '',
      career: '',
    },
    // 진단 문항
    answers: new Array(TOTAL_QUESTIONS).fill(0), // 0 = 미선택
    shuffledQuestions: createShuffledQuestions(),
    currentIndex: 0,
    isCompleted: false,
    result: null,
  }
}

const initialState = createInitialState()

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

    case 'NEXT_QUESTION': {
      const nextIndex = state.currentIndex + 1
      if (nextIndex >= TOTAL_QUESTIONS) {
        const result = buildResult(state.answers, state.studentName, state.shuffledQuestions)
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
