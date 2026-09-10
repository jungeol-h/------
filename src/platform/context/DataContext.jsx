// 플랫폼 데이터 컨텍스트 — Provider 조립만 담당한다.
//
// 구조: 이 파일은 역할별 fetch 라우팅 + 도메인 훅 결합만 한다.
//  - fetchers/  : 역할별 초기 데이터 fetch
//  - domains/   : [Write] 도메인별 CRUD 훅
//  - selectors/ : [Read] cross-domain 종합 (페이지에서 직접 import)
//  - events/    : 도메인 간 부수효과(알림 등) 룰
// useData() 공개 API는 기존과 동일하게 유지한다.

import {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef,
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
import { reportFinalFetchFailure } from '../lib/supabaseHelpers.js'
import { useRevalidateOnResume } from '../hooks/useRevalidateOnResume.js'

const DataContext = createContext(null)

// fetch 재시도 백오프 — 모바일 복귀 직후 네트워크가 깨어나기 전이면
// 첫 시도가 타임아웃/네트워크 에러로 떨어지므로, 잠시 뒤 전체를 다시 시도한다.
const LOAD_BACKOFF_MS = [1000, 3000]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 역할별 전체 fetch를 transient(일시적 네트워크) 에러에 한해 백오프 재시도.
// 초기 로드와 refetch가 공유한다. throw하지 않고 결과 객체로 돌려준다:
//   { fetched, retryCount } 성공 또는 재시도 소진(스냅샷에 transient 에러 잔존 가능)
//   { error, retryCount }   fetch 자체가 throw로 최종 실패
//   { cancelled: true }     호출측이 취소됨
async function fetchWithTransientRetry(fetchAll, isCancelled) {
  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < LOAD_BACKOFF_MS.length
    let fetched
    try {
      fetched = await fetchAll()
    } catch (err) {
      if (isCancelled()) return { cancelled: true }
      if (canRetry && isTransientFetchMessage(err?.message ?? String(err))) {
        await sleep(LOAD_BACKOFF_MS[attempt])
        if (isCancelled()) return { cancelled: true }
        continue
      }
      return { error: err, retryCount: attempt }
    }
    if (isCancelled()) return { cancelled: true }
    // 표 단위 에러는 collectRows가 _fetchErrors에 transient 표시와 함께 모은다.
    const hasTransient = (fetched?._fetchErrors ?? []).some((e) => e.transient)
    if (hasTransient && canRetry) {
      await sleep(LOAD_BACKOFF_MS[attempt])
      if (isCancelled()) return { cancelled: true }
      continue
    }
    return { fetched, retryCount: attempt }
  }
}

export function DataProvider({ children }) {
  const { currentUser } = useAuth()
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false) // refetch 전용 (loading과 분리 — 대시보드 전체 로더 방지)
  const [dataReady, setDataReady] = useState(false)

  const userId = currentUser?.id
  const userRole = currentUser?.role

  // 최신 data 미러 — 복귀 재검증 force 판정이 stale 클로저를 보지 않게.
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  // 현재 userId 미러 — 로그아웃·계정 전환 도중 완료된 refetch가
  // 이전 사용자의 스냅샷을 적용하지 않도록 폐기 판정에 쓴다.
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  // 마지막 "에러 없는 완전한 스냅샷" 적용 시각 — 복귀 재검증 staleness 기준.
  const lastLoadedAtRef = useRef(0)

  // 쓰기 세대 카운터 — 도메인 훅의 로컬 동기화(setData)마다 증가한다.
  // refetch가 fetch를 시작한 뒤 세대가 변했으면 그 스냅샷은 방금 쓴 행을
  // 모르는 낡은 것이므로 폐기한다 (전체 교체 모델의 쓰기 경합 방어).
  const writeGenRef = useRef(0)
  const domainSetData = useCallback((updater) => {
    writeGenRef.current += 1
    setData(updater)
  }, [])

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
      const result = await fetchWithTransientRetry(fetchAll, () => cancelled)
      if (result.cancelled) return
      if (result.error) {
        const message = result.error?.message ?? String(result.error)
        reportError(result.error, { where: 'DataContext.load', role: currentUser?.role, retryCount: result.retryCount })
        // fetch 전체가 실패해도 침묵하지 않도록 _fetchErrors에 남긴다.
        setData({
          ...EMPTY,
          _fetchErrors: [{ table: '전체', message, transient: isTransientFetchMessage(message) }],
        })
      } else {
        // 재시도 소진 후에도 남은 일시적 실패만 여기서 1건 보고 (collectRows는 침묵).
        reportFinalFetchFailure(result.fetched._fetchErrors, { role: currentUser?.role, retryCount: result.retryCount })
        setData(result.fetched)
        if (!result.fetched._fetchErrors?.length) lastLoadedAtRef.current = Date.now()
      }
      setDataReady(true)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
    // currentUser 객체 identity가 아니라 id/role 변경에만 refetch하려는 의도적 deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role, fetchAll])

  // 새로고침(수동 버튼·복귀 재검증 공용) — loading/dataReady는 건드리지 않아
  // 화면을 로딩 상태로 갈아엎지 않는다. (loading=true면 역할별 Dashboard가 전체
  // 로더로 전환되며 라우터 트리가 언마운트되므로 refreshing을 따로 쓴다.)
  // single-flight: 자동 트리거·수동 버튼·동시 호출은 진행 중인 refetch를 공유한다.
  const refetchPromiseRef = useRef(null)
  const refetch = useCallback(() => {
    if (!userId) return Promise.resolve()
    if (refetchPromiseRef.current) return refetchPromiseRef.current

    const run = async () => {
      setRefreshing(true)
      // 로그아웃·계정 전환이 끼어들면 결과를 통째로 폐기한다.
      const isStale = () => userIdRef.current !== userId
      try {
        const startGen = writeGenRef.current
        let result = await fetchWithTransientRetry(fetchAll, isStale)
        if (result.cancelled) return
        // fetch 도중 도메인 쓰기가 로컬 반영됐다면 이 스냅샷은 그 행을 모른다 —
        // 적용하면 방금 저장한 데이터가 화면에서 사라진다. 폐기하고 한 번만 다시 시도.
        if (!result.error && writeGenRef.current !== startGen) {
          const retryGen = writeGenRef.current
          result = await fetchWithTransientRetry(fetchAll, isStale)
          if (result.cancelled) return
          if (!result.error && writeGenRef.current !== retryGen) return // 다음 트리거가 따라잡는다
        }
        if (result.error) {
          const message = result.error?.message ?? String(result.error)
          reportError(result.error, { where: 'DataContext.refetch', role: userRole, retryCount: result.retryCount })
          // 기존 데이터는 유지하고 실패 사실만 배너로 알린다.
          setData((prev) => ({
            ...prev,
            _fetchErrors: [{ table: '전체', message, transient: isTransientFetchMessage(message) }],
          }))
          return
        }
        const fetched = result.fetched
        if ((fetched._fetchErrors ?? []).some((e) => e.transient)) {
          // 부분 실패 스냅샷은 실패 테이블이 []로 비어 있어 정상 데이터를 덮으면
          // 안 된다. 기존 데이터를 유지하고 에러 상태만 갱신해 배너로 알린다.
          reportFinalFetchFailure(fetched._fetchErrors, { role: userRole, retryCount: result.retryCount })
          setData((prev) => ({ ...prev, _fetchErrors: fetched._fetchErrors }))
          return
        }
        setData(fetched)
        if (!fetched._fetchErrors?.length) lastLoadedAtRef.current = Date.now()
      } catch (err) {
        // 예기치 못한 throw — 기존 데이터 유지, 보고만.
        reportError(err, { where: 'DataContext.refetch', role: userRole })
      } finally {
        setRefreshing(false)
        refetchPromiseRef.current = null
      }
    }

    refetchPromiseRef.current = run()
    return refetchPromiseRef.current
  }, [userId, userRole, fetchAll])

  // 복귀 재검증 — 앱이 다시 보이거나(online 포함) 살아났을 때, 에러 배너가 떠
  // 있으면 즉시, 아니면 마지막 완전 로드가 3분 이상 지났을 때만 조용히 refetch.
  useRevalidateOnResume(refetch, {
    enabled: Boolean(userId) && !loading,
    getLastSuccessAt: () => lastLoadedAtRef.current,
    force: () => (dataRef.current._fetchErrors?.length ?? 0) > 0,
  })

  // [Write] 도메인 훅 결합 — domainSetData(쓰기 세대 카운터 포함)를 주입한다.
  const mind = useMindDomain(domainSetData)
  const diary = useDiaryDomain(data, domainSetData)
  const alert = useAlertDomain(domainSetData)
  const task = useTaskDomain(data, domainSetData)
  const learning = useLearningDomain(domainSetData)
  const career = useCareerDomain(domainSetData)
  const quiz = useQuizDomain(data, domainSetData)
  const student = useStudentDomain(domainSetData)
  const counseling = useCounselingDomain(domainSetData)
  const attendance = useAttendanceDomain(domainSetData)
  const parent = useParentDomain(domainSetData)
  const educator = useEducatorDomain(domainSetData)
  const selfScore = useSelfScoreDomain(domainSetData)
  const workPlan = useWorkPlanDomain(domainSetData)
  const urgentReport = useUrgentReportDomain(domainSetData)
  const workRecords = useWorkRecordsDomain(domainSetData)
  const notice = useNoticeDomain(domainSetData)
  const centerClosure = useCenterClosureDomain(domainSetData)
  const studentFeedback = useStudentFeedbackDomain(domainSetData)

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
