import { createContext, useContext, useReducer } from 'react'
import { buildResult } from '../utils/scoreCalculator'
import { TOTAL_QUESTIONS } from '../data/questions'

const DiagnosisContext = createContext(null)

const initialState = {
  studentName: '',
  answers: new Array(TOTAL_QUESTIONS).fill(0), // 0 = 미선택
  currentIndex: 0,
  isCompleted: false,
  result: null,
}

function reducer(state, action) {
  switch (action.type) {
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
        const result = buildResult(state.answers, state.studentName)
        return { ...state, currentIndex: nextIndex, isCompleted: true, result }
      }
      return { ...state, currentIndex: nextIndex }
    }

    case 'PREV_QUESTION':
      return { ...state, currentIndex: Math.max(0, state.currentIndex - 1) }

    case 'RESET':
      return { ...initialState, answers: new Array(TOTAL_QUESTIONS).fill(0) }

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
