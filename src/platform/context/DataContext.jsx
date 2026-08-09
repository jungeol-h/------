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
import { useEducatorDomain } from './domains/educatorDomain.js'
import { useSelfScoreDomain } from './domains/selfScoreDomain.js'
import { useWorkPlanDomain } from './domains/workPlanDomain.js'
import { useUrgentReportDomain } from './domains/urgentReportDomain.js'
import { useWorkRecordsDomain } from './domains/workRecordsDomain.js'
import { useNoticeDomain } from './domains/noticeDomain.js'
import { useCenterClosureDomain } from './domains/centerClosureDomain.js'
import { useStudentFeedbackDomain } from './domains/studentFeedbackDomain.js'
import { getWeeklyLearning as selectWeeklyLearning } from './selectors/weeklyLearning.js'
import { reportError, setSentryUser } from '../lib/sentry.js'
import { isTransientFetchMessage } from '../lib/supabaseRetry.js'

const DataContext = createContext(null)

// 초기 fetch 재시도 백오프 — 모바일 복귀 직후 네트워크가 깨어나기 전이면
// 첫 시도가 타임아웃/네트워크 에러로 떨어지므로, 잠시 뒤 전체를 다시 시도한다.
const INITIAL_LOAD_BACKOFF_MS = [1000, 3000]

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
    // 직원 3종은 admin fetcher 공유하되 자기 소속 그룹(users.group_names)으로 스코프된다
    if (['instructor', 'consultant', 'viewer'].includes(userRole)) return fetchForAdmin({ userId, role: userRole })
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
      // 일시적 네트워크 장애(타임아웃 포함)면 전체 fetch를 백오프 후 재시도한다.
      // 표 단위 에러는 collectRows가 _fetchErrors로 모으므로 결과를 보고 판단한다.
      for (let attempt = 0; attempt <= INITIAL_LOAD_BACKOFF_MS.length; attempt++) {
        const canRetry = attempt < INITIAL_LOAD_BACKOFF_MS.length
        try {
          const fetched = await fetchAll()
          if (cancelled) return
          const hasTransientError = (fetched?._fetchErrors ?? [])
            .some((e) => isTransientFetchMessage(e.message))
          if (hasTransientError && canRetry) {
            await new Promise((r) => setTimeout(r, INITIAL_LOAD_BACKOFF_MS[attempt]))
            if (cancelled) return
            continue
          }
          setData(fetched)
          setDataReady(true)
        } catch (err) {
          if (cancelled) return
          if (canRetry && isTransientFetchMessage(err?.message ?? String(err))) {
            await new Promise((r) => setTimeout(r, INITIAL_LOAD_BACKOFF_MS[attempt]))
            if (cancelled) return
            continue
          }
          reportError(err, { where: 'DataContext.load', role: currentUser?.role, retryCount: attempt })
          // fetch 전체가 실패해도 침묵하지 않도록 _fetchErrors에 남긴다.
          setData({
            ...EMPTY,
            _fetchErrors: [{ table: '전체', message: err?.message ?? String(err) }],
          })
          setDataReady(true)
        }
        setLoading(false)
        return
      }
    }

    load()
    return () => { cancelled = true }
    // currentUser 객체 identity가 아니라 id/role 변경에만 refetch하려는 의도적 deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const educator = useEducatorDomain(setData)
  const selfScore = useSelfScoreDomain(setData)
  const workPlan = useWorkPlanDomain(setData)
  const urgentReport = useUrgentReportDomain(setData)
  const workRecords = useWorkRecordsDomain(setData)
  const notice = useNoticeDomain(setData)
  const centerClosure = useCenterClosureDomain(setData)
  const studentFeedback = useStudentFeedbackDomain(setData)

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
      ...educator,
      ...selfScore,
      ...workPlan,
      ...urgentReport,
      ...workRecords,
      ...notice,
      ...centerClosure,
      ...studentFeedback,
      getWeeklyLearning,
      resetData,
      refetch,
    }),
    [data, loading, refreshing, dataReady, mind, diary, alert, task, learning, career, quiz, student, counseling, attendance, parent, educator, selfScore, workPlan, urgentReport, workRecords, notice, centerClosure, studentFeedback, getWeeklyLearning, resetData, refetch]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
