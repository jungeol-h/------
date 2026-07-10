// 플랫폼 데이터 컨텍스트 — Provider 조립만 담당한다.
//
// 구조: 이 파일은 역할별 fetch 라우팅 + 도메인 훅 결합만 한다.
//  - fetchers/  : 역할별 초기 데이터 fetch
//  - domains/   : [Write] 도메인별 CRUD 훅
//  - selectors/ : [Read] cross-domain 종합 (페이지에서 직접 import)
//  - events/    : 도메인 간 부수효과(알림 등) 룰
// useData() 공개 API는 기존과 동일하게 유지한다.

import {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
} from 'react'
import { useAuth } from './AuthContext.jsx'
import { EMPTY } from './dataModel.js'
import { fetchForStudent } from './fetchers/fetchForStudent.js'
import { fetchForManager } from './fetchers/fetchForManager.js'
import { fetchForAdmin } from './fetchers/fetchForAdmin.js'
import { fetchForParent } from './fetchers/fetchForParent.js'
import { useMindDomain } from './domains/mindDomain.js'
import { useDiaryDomain } from './domains/diaryDomain.js'
import { useAlertDomain } from './domains/alertDomain.js'
import { useTaskDomain } from './domains/taskDomain.js'
import { useLearningDomain } from './domains/learningDomain.js'
import { useCareerDomain } from './domains/careerDomain.js'
import { useQuizDomain } from './domains/quizDomain.js'
import { useStudentDomain } from './domains/studentDomain.js'
import { useCounselingDomain } from './domains/counselingDomain.js'
import { useAttendanceDomain } from './domains/attendanceDomain.js'
import { useParentDomain } from './domains/parentDomain.js'
import { getWeeklyLearning as selectWeeklyLearning } from './selectors/weeklyLearning.js'
import { reportError, setSentryUser } from '../lib/sentry.js'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { currentUser } = useAuth()
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false) // 수동 refetch 전용 (loading과 분리 — 대시보드 전체 로더 방지)
  const [dataReady, setDataReady] = useState(false)

  const userId = currentUser?.id
  const userRole = currentUser?.role

  // 역할별 fetch 라우팅 — 초기 로드(useEffect)와 수동 refetch가 공유한다.
  const fetchAll = useCallback(async () => {
    if (userRole === 'student') return fetchForStudent(userId)
    if (userRole === 'manager') return fetchForManager(userId)
    if (userRole === 'admin') return fetchForAdmin()
    if (userRole === 'parent') return fetchForParent(userId)
    if (['instructor', 'consultant', 'viewer'].includes(userRole)) return fetchForAdmin()
    return EMPTY
  }, [userId, userRole])

  // currentUser 변경 시 역할별 fetch
  useEffect(() => {
    setSentryUser(currentUser ?? null)
    if (!currentUser) {
      setData(EMPTY)
      setDataReady(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setDataReady(false)

    const load = async () => {
      try {
        const fetched = await fetchAll()
        if (!cancelled) {
          setData(fetched)
          setDataReady(true)
        }
      } catch (err) {
        reportError(err, { where: 'DataContext.load', role: currentUser?.role })
        if (!cancelled) {
          // fetch 전체가 실패해도 침묵하지 않도록 _fetchErrors에 남긴다.
          setData({
            ...EMPTY,
            _fetchErrors: [{ table: '전체', message: err?.message ?? String(err) }],
          })
          setDataReady(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [currentUser?.id, currentUser?.role, fetchAll])

  // 수동 새로고침 — loading/dataReady는 건드리지 않아 화면을 로딩 상태로 갈아엎지 않는다.
  // (역할별 Dashboard가 loading=true면 전체 로더로 전환되므로 refreshing을 따로 쓴다.)
  // 실패 시 기존 데이터를 그대로 두고 Sentry에만 보고한다.
  const refetch = useCallback(async () => {
    if (!userId) return
    setRefreshing(true)
    try {
      const fetched = await fetchAll()
      setData(fetched)
    } catch (err) {
      reportError(err, { where: 'DataContext.refetch', role: userRole })
    } finally {
      setRefreshing(false)
    }
  }, [userId, userRole, fetchAll])

  // [Write] 도메인 훅 결합
  const mind = useMindDomain(setData)
  const diary = useDiaryDomain(data, setData)
  const alert = useAlertDomain(setData)
  const task = useTaskDomain(data, setData)
  const learning = useLearningDomain(setData)
  const career = useCareerDomain(setData)
  const quiz = useQuizDomain(data, setData)
  const student = useStudentDomain(setData)
  const counseling = useCounselingDomain(setData)
  const attendance = useAttendanceDomain(setData)
  const parent = useParentDomain(setData)

  // getWeeklyLearning — selector를 data에 바인딩해 기존 useData() API 호환 유지.
  const getWeeklyLearning = useCallback(
    (studentId) => selectWeeklyLearning(data, studentId),
    [data]
  )

  const resetData = useCallback(() => {
    setData(EMPTY)
  }, [])

  const value = useMemo(
    () => ({
      data,
      loading,
      refreshing,
      dataReady,
      ...mind,
      ...diary,
      ...alert,
      ...task,
      ...learning,
      ...career,
      ...quiz,
      ...student,
      ...counseling,
      ...attendance,
      ...parent,
      getWeeklyLearning,
      resetData,
      refetch,
    }),
    [data, loading, refreshing, dataReady, mind, diary, alert, task, learning, career, quiz, student, counseling, attendance, parent, getWeeklyLearning, resetData, refetch]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
