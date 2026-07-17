// 예약 시스템 전용 Provider — 예약 라우트 서브트리에만 마운트되는 격리 데이터 계층.
//
// DataContext에 넣지 않는 이유: 예약·정원은 타인이 계속 갱신하는 데이터라
// "로그인 시 1회 fetch 후 로컬 동기화" 모델과 맞지 않는다. 화면 진입 시마다
// lazy fetch하고, 쓰기 후에는 전체 refetch로 정합성을 되찾는다 (60명 규모라 저비용).
// 기존 컬렉션(users·students·parentChildren)은 useData()에서 읽기만 한다.
//
// 마이그레이션 미적용 시: fetch 실패를 자체 error 화면으로 처리 — 기존
// _fetchErrors 배너·다른 탭에는 영향이 없다 (격리 원칙).

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'
import { daysAgoStr, todayStr } from '../utils/dateUtils.js'
import { addDaysStr } from './bookingRules.js'
import * as api from './bookingApi.js'

const BookingContext = createContext(null)

const EDUCATOR_ROLES = ['manager', 'instructor', 'consultant']

export function BookingProvider({ children }) {
  const { currentUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [config, setConfig] = useState({ programs: [], subjects: [], educators: [], openPeriods: [] })
  const [slots, setSlots] = useState([])
  const [reservations, setReservations] = useState([])
  const [records, setRecords] = useState([])
  const [slotCounts, setSlotCounts] = useState({})
  const [notifications, setNotifications] = useState([])
  const [userNames, setUserNames] = useState({})
  const aliveRef = useRef(true)

  const role = currentUser?.role
  const userId = currentUser?.id
  const isStaff = role === 'admin' || EDUCATOR_ROLES.includes(role)

  const fetchAll = useCallback(async () => {
    if (!userId) return null
    // 조회 윈도: 과거 60일(출결·기록 마감 업무) ~ 미래 90일(사전예약)
    const from = daysAgoStr(60)
    const to = addDaysStr(todayStr(), 90)
    {
      // 역할별 본 데이터 fetch — config·알림과 독립이므로 병렬로 묶는다
      const fetchRoleData = async () => {
        if (role === 'admin') {
          const [slotRows, resRows, recRows] = await Promise.all([
            api.fetchSlots({ from, to }),
            api.fetchReservations({ from, to }),
            api.fetchRecords({ from, to }),
          ])
          return { slots: slotRows, reservations: resRows, records: recRows, counts: {} }
        }
        if (EDUCATOR_ROLES.includes(role)) {
          const [slotRows, resRows, recRows] = await Promise.all([
            api.fetchSlots({ from, to, educatorId: userId }),
            api.fetchReservations({ from, to, educatorId: userId }),
            api.fetchRecords({ educatorId: userId, from, to }),
          ])
          return { slots: slotRows, reservations: resRows, records: recRows, counts: {} }
        }
        if (role === 'parent') {
          // 자녀별 조회는 화면(자녀 선택)에서 studentId로 필터 — 여기서는 링크된 전 자녀분
          const { data: linkRows, error: linkErr } = await supabase
            .from('parent_children').select('student_id').eq('parent_id', userId)
          if (linkErr) throw linkErr
          const childIds = (linkRows ?? []).map((r) => r.student_id)
          const [slotRows, counts, resRows] = await Promise.all([
            api.fetchSlots({ from: todayStr(), to, statuses: ['open'], publicOnly: true }),
            api.fetchSlotCounts({ from: todayStr(), to }),
            childIds.length ? api.fetchReservations({ from, to, studentIds: childIds }) : Promise.resolve([]),
          ])
          return { slots: slotRows, reservations: resRows, records: [], counts }
        }
        // student
        const [slotRows, counts, resRows] = await Promise.all([
          api.fetchSlots({ from: todayStr(), to, statuses: ['open'], publicOnly: true }),
          api.fetchSlotCounts({ from: todayStr(), to }),
          api.fetchReservations({ from, to, studentId: userId }),
        ])
        return { slots: slotRows, reservations: resRows, records: [], counts }
      }

      const [cfg, notif, roleData] = await Promise.all([
        api.fetchBookingConfig(),
        api.fetchNotifications(userId),
        fetchRoleData(),
      ])
      const { slots: nextSlots, reservations: nextReservations, records: nextRecords } = roleData
      let nextCounts = roleData.counts

      // 강사·관리자는 확정 예약으로 정원 카운트 파생 (별도 조회 불필요)
      if (isStaff) {
        nextCounts = {}
        for (const r of nextReservations) {
          if (r.status === 'confirmed') nextCounts[r.slotId] = (nextCounts[r.slotId] ?? 0) + 1
        }
      }

      // 이름 맵 — 슬롯·배정에 등장하는 강사 + (강사·관리자 화면의) 예약 학생
      const nameIds = [
        ...cfg.educators.map((e) => e.educatorId),
        ...nextSlots.map((s) => s.educatorId),
        ...(isStaff ? nextReservations.map((r) => r.studentId) : []),
      ]
      const names = await api.fetchUserNames(nameIds)

      return {
        cfg, notif, names,
        slots: nextSlots, reservations: nextReservations,
        records: nextRecords, counts: nextCounts,
      }
    }
  }, [role, userId, isStaff])

  // fetch 결과를 상태에 반영 — 반드시 async 흐름(await 이후)에서만 호출한다
  const refetch = useCallback(async () => {
    try {
      const payload = await fetchAll()
      if (!payload || !aliveRef.current) return
      setConfig(payload.cfg)
      setSlots(payload.slots)
      setReservations(payload.reservations)
      setRecords(payload.records)
      setSlotCounts(payload.counts)
      setNotifications(payload.notif)
      setUserNames(payload.names)
      setError(null)
    } catch (e) {
      if (aliveRef.current) setError(e)
    }
  }, [fetchAll])

  // loading은 초기값 true로 시작 — Provider는 예약 라우트 진입마다 새로 마운트된다.
  // setState는 effect 본문이 아니라 load 클로저의 await 이후에만 (DataContext 관례)
  useEffect(() => {
    aliveRef.current = true
    const load = async () => {
      try {
        await refetch()
      } finally {
        if (aliveRef.current) setLoading(false)
      }
    }
    load()
    return () => { aliveRef.current = false }
  }, [refetch])

  // 인앱 알림 실시간 수신 (manager/AttendanceTab.jsx의 Realtime 패턴)
  useEffect(() => {
    if (!userId) return undefined
    const channel = supabase
      .channel('booking-notifications')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'booking_notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const item = api.toBookingNotification(payload.new)
        setNotifications((prev) => (prev.some((n) => n.id === item.id) ? prev : [item, ...prev]))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // 쓰기 액션 — RPC 결과({ ok, code })를 그대로 반환하고, 성공 시 전체 refetch.
  const actor = useMemo(() => ({ id: userId, role }), [userId, role])

  const value = useMemo(() => {
    const afterWrite = async (result) => {
      if (result?.ok !== false) await refetch()
      return result
    }
    return {
      loading, error, refetch,
      config, slots, reservations, records, slotCounts, notifications, userNames,
      actor,

      reserve: (p) => api.rpcReserve({ ...p, actorId: userId, actorRole: role }).then(afterWrite),
      cancel: (p) => api.rpcCancel({ ...p, actorId: userId, actorRole: role }).then(afterWrite),
      change: (p) => api.rpcChange({ ...p, actorId: userId, actorRole: role }).then(afterWrite),
      assignGroup: (p) => api.rpcAssignGroup({ ...p, actorId: userId, actorRole: role }).then(afterWrite),
      setAttendance: (p) => api.rpcSetAttendance({ ...p, actorId: userId, actorRole: role }).then(afterWrite),
      updateSlot: (p) => api.rpcUpdateSlot({ ...p, actorId: userId, actorRole: role }).then(afterWrite),
      setSlotStatus: (p) => api.rpcSetSlotStatus({ ...p, actorId: userId, actorRole: role }).then(afterWrite),

      saveRecord: (input) => api.saveRecord(input, actor).then((r) => refetch().then(() => r)),
      createProgram: (input) => api.createProgram(input, actor).then((r) => refetch().then(() => r)),
      updateProgram: (id, patch, before) => api.updateProgram(id, patch, actor, before).then(refetch),
      createSubject: (input) => api.createSubject(input, actor).then(refetch),
      updateSubject: (id, patch) => api.updateSubject(id, patch, actor).then(refetch),
      assignEducator: (input) => api.assignEducator(input, actor).then(refetch),
      removeEducator: (id) => api.removeEducator(
        id, actor, config.educators.find((e) => e.id === id) ?? null,
      ).then(refetch),
      createOpenPeriod: (input) => api.createOpenPeriod(input, actor).then(refetch),
      updateOpenPeriod: (id, patch) => api.updateOpenPeriod(id, patch, actor).then(refetch),
      deleteOpenPeriod: (id) => api.deleteOpenPeriod(id, actor).then(refetch),
      createSlot: (input) => api.createSlot(input, actor).then((r) => refetch().then(() => r)),
      createSlotBatch: (input) => api.createSlotBatch(input, actor).then((r) => refetch().then(() => r)),

      resolveNotification: async (id) => {
        await api.resolveNotification(id)
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, resolved: true } : n)))
      },
      resolveAllNotifications: async () => {
        await api.resolveAllNotifications(userId)
        setNotifications((prev) => prev.map((n) => ({ ...n, resolved: true })))
      },
      fetchAuditLogs: api.fetchAuditLogs,
    }
  }, [loading, error, refetch, config, slots, reservations, records, slotCounts,
      notifications, userNames, actor, userId, role])

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
}

export function useBooking() {
  const ctx = useContext(BookingContext)
  if (!ctx) throw new Error('useBooking must be used within BookingProvider')
  return ctx
}
