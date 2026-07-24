// 학생 홈 '오늘의 센터 일정' 데이터 훅 — booking·centerHours 격리 모듈을 읽기 전용으로
// 마운트 시 lazy fetch한다 (격리 원칙: DataContext·fetchers 무관, 쓰기 없음).
// 어느 한쪽이 실패(마이그레이션 미적용 포함)해도 그 파트만 error로 표시하고
// 홈 화면 전체는 깨지지 않는다.

import { useEffect, useState } from 'react'
import {
  fetchBookingNameMaps,
  fetchReservations,
  fetchUserNames,
} from '../../booking/bookingApi.js'
import { fetchStudentCenterHours } from '../../centerHours/centerHoursApi.js'
import { CENTER_HOUR_UNITS } from '../../data/centerHours.js'
import { todayStr } from '../../utils/dateUtils.js'

// 오늘 확정 예약 → 표시용 아이템 목록 (시간순)
async function loadTodayReservations(studentId, today) {
  const rows = await fetchReservations({ from: today, to: today, studentId })
  const confirmed = rows
    .filter((r) => r.status === 'confirmed' && r.slot)
    .sort((a, b) => (a.slot.startTime < b.slot.startTime ? -1 : 1))
  if (confirmed.length === 0) return []

  const [{ programNames, subjectNames }, userNames] = await Promise.all([
    fetchBookingNameMaps(),
    fetchUserNames(confirmed.map((r) => r.slot.educatorId)),
  ])
  return confirmed.map((r) => ({
    id: r.id,
    startTime: r.slot.startTime,
    endTime: r.slot.endTime,
    programName: programNames[r.programId] ?? '상담',
    subjectName: r.slot.subjectId ? (subjectNames[r.slot.subjectId] ?? '') : '',
    educatorName: userNames[r.slot.educatorId]?.name ?? '담당 미정',
  }))
}

// 오늘 요일의 이용시간 등록 → { isOperatingDay, units, checkIn, checkOut }
async function loadTodayCenterHours(studentId, dayOfWeek) {
  const isOperatingDay = Boolean(CENTER_HOUR_UNITS[dayOfWeek])
  if (!isOperatingDay) return { isOperatingDay, units: [] }
  const rows = await fetchStudentCenterHours(studentId)
  const units = rows
    .filter((r) => r.dayOfWeek === dayOfWeek)
    .sort((a, b) => (a.startTime < b.startTime ? -1 : 1))
  return {
    isOperatingDay,
    units,
    checkIn: units[0]?.startTime,
    checkOut: units[units.length - 1]?.endTime,
  }
}

export default function useTodayCenterSchedule(studentId) {
  const [reservations, setReservations] = useState({ loading: true })
  const [centerHours, setCenterHours] = useState({ loading: true })

  useEffect(() => {
    if (!studentId) return
    let alive = true
    const today = todayStr()
    const dayOfWeek = new Date().getDay()

    loadTodayReservations(studentId, today)
      .then((items) => { if (alive) setReservations({ items }) })
      .catch(() => { if (alive) setReservations({ error: true }) })
    loadTodayCenterHours(studentId, dayOfWeek)
      .then((result) => { if (alive) setCenterHours(result) })
      .catch(() => { if (alive) setCenterHours({ error: true, isOperatingDay: true, units: [] }) })

    return () => { alive = false }
  }, [studentId])

  return { reservations, centerHours }
}
