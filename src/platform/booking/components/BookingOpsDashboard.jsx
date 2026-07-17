// 관리자 운영현황 대시보드 — 명세 15.1·15.2.
// 당일 운영현황 + 미처리 업무(출결·기록) + 일정 이상 탐지. 전부 조회 시점 파생(저장 없음).

// 파생 계산은 React Compiler가 자동 메모이즈한다 — 수동 useMemo는 클로저 의존성
// 추론과 충돌해 컴파일 스킵을 유발하므로 쓰지 않는다.
import { todayStr } from '../../utils/dateUtils.js'
import { useBooking } from '../BookingContext.jsx'
import { overlaps, todayStrKst } from '../bookingRules.js'
import { recordState } from '../bookingStatus.js'

export default function BookingOpsDashboard() {
  const { config, slots, reservations, records, userNames } = useBooking()
  const today = todayStr()

  const studentName = (id) => userNames[id]?.name ?? id
  const educatorName = (id) => userNames[id]?.name ?? (id ? id : '미지정')
  const programName = (id) => config.programs.find((p) => p.id === id)?.name ?? id

  // ─── 당일 운영현황 ──────────────────────────────────────────
  const todayStats = (() => {
    const todays = reservations.filter((r) => r.slot?.date === today)
    const confirmed = todays.filter((r) => r.status === 'confirmed')
    const perProgram = {}
    for (const r of confirmed) {
      perProgram[r.programId] = (perProgram[r.programId] ?? 0) + 1
    }
    const openSlots = slots.filter((s) => s.date === today && s.status === 'open')
    const seatTotal = openSlots.reduce((sum, s) => sum + s.capacity, 0)
    return {
      total: confirmed.length,
      perProgram,
      cancelled: todays.filter((r) => r.status === 'cancelled').length,
      moved: todays.filter((r) => r.status === 'moved').length,
      absent: confirmed.filter((r) => r.attendanceStatus === 'absent').length,
      remaining: Math.max(0, seatTotal - confirmed.length),
    }
  })()

  // ─── 미처리 업무 ────────────────────────────────────────────
  const kstToday = todayStrKst()
  const pendingAttendance = reservations
    .filter((r) => r.status === 'confirmed' && r.attendanceStatus === 'pending' && r.slot && r.slot.date < kstToday)
    .sort((a, b) => (a.slot.date < b.slot.date ? -1 : 1))

  const recordIssues = (() => {
    const dueSoon = []
    const overdue = []
    for (const r of reservations) {
      if (r.status !== 'confirmed' || r.attendanceStatus !== 'attended' || !r.slot) continue
      const state = recordState(r, records.find((x) => x.reservationId === r.id), r.slot.date)
      if (state === 'due_soon' || state === 'draft') dueSoon.push(r)
      else if (state === 'overdue') overdue.push(r)
    }
    return { dueSoon, overdue }
  })()

  // ─── 일정 이상 (명세 15.2) ──────────────────────────────────
  const anomalies = (() => {
    const list = []
    const upcoming = slots.filter((s) => s.date >= today && s.status !== 'cancelled')

    // 정원 초과 (예외 처리 등으로 발생)
    const countBySlot = {}
    for (const r of reservations) {
      if (r.status === 'confirmed') countBySlot[r.slotId] = (countBySlot[r.slotId] ?? 0) + 1
    }
    for (const s of upcoming) {
      if ((countBySlot[s.id] ?? 0) > s.capacity) {
        list.push({ key: `cap-${s.id}`, label: `정원 초과 — ${s.date} ${s.startTime} ${programName(s.programId)} (${countBySlot[s.id]}/${s.capacity})` })
      }
      if (!s.educatorId && s.status === 'open') {
        list.push({ key: `edu-${s.id}`, label: `담당 강사 미지정 — ${s.date} ${s.startTime} ${programName(s.programId)}` })
      }
    }

    // 강사 중복배정 — 같은 강사의 겹치는 슬롯
    const byEducatorDate = {}
    for (const s of upcoming) {
      if (!s.educatorId) continue
      const key = `${s.educatorId}|${s.date}`
      ;(byEducatorDate[key] = byEducatorDate[key] ?? []).push(s)
    }
    for (const group of Object.values(byEducatorDate)) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (overlaps(group[i].startTime, group[i].endTime, group[j].startTime, group[j].endTime)) {
            list.push({
              key: `dup-${group[i].id}-${group[j].id}`,
              label: `강사 중복배정 — ${educatorName(group[i].educatorId)} ${group[i].date} ${group[i].startTime}/${group[j].startTime}`,
            })
          }
        }
      }
    }

    // 학생 시간 중복 (예외 처리 등으로 발생)
    const byStudentDate = {}
    for (const r of reservations) {
      if (r.status !== 'confirmed' || !r.slot || r.slot.date < today) continue
      const key = `${r.studentId}|${r.slot.date}`
      ;(byStudentDate[key] = byStudentDate[key] ?? []).push(r)
    }
    for (const group of Object.values(byStudentDate)) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (overlaps(group[i].slot.startTime, group[i].slot.endTime, group[j].slot.startTime, group[j].slot.endTime)) {
            list.push({
              key: `ovl-${group[i].id}-${group[j].id}`,
              label: `학생 시간 중복 — ${studentName(group[i].studentId)} ${group[i].slot.date} ${group[i].slot.startTime}/${group[j].slot.startTime}`,
            })
          }
        }
      }
    }

    // 공개기간 미설정 — 사전예약형 프로그램에 현재·미래 오픈기간이 없음
    for (const p of config.programs) {
      if (!p.active || !p.requiresOpenPeriod) continue
      const hasFuture = config.openPeriods.some(
        (op) => op.programId === p.id && new Date(op.openUntil) >= new Date(),
      )
      if (!hasFuture) {
        list.push({ key: `op-${p.id}`, label: `공개기간 미설정 — ${p.name} (예약 오픈기간을 등록해 주세요)` })
      }
    }
    return list
  })()

  const statCard = (label, value, tone = 'text-gray-900') => (
    <div className="bg-white rounded-xl shadow-sm p-3 text-center">
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
    </div>
  )

  const issueList = (title, items, render, tone) => items.length > 0 && (
    <section className="space-y-1.5">
      <h4 className={`text-xs font-bold ${tone}`}>{title} ({items.length})</h4>
      {items.slice(0, 10).map(render)}
      {items.length > 10 && <p className="text-[11px] text-gray-400">외 {items.length - 10}건</p>}
    </section>
  )

  const resLine = (r) => (
    <div key={r.id} className="bg-white rounded-lg shadow-sm px-3 py-2 text-xs text-gray-600 flex justify-between">
      <span>{r.slot.date} {r.slot.startTime} · {studentName(r.studentId)} · {programName(r.programId)}</span>
      <span className="text-gray-400">{educatorName(r.slot.educatorId)}</span>
    </div>
  )

  return (
    <div className="space-y-5">
      <section>
        <h4 className="text-xs font-bold text-gray-400 mb-2">오늘 운영현황 ({today})</h4>
        <div className="grid grid-cols-3 gap-2">
          {statCard('오늘 예약', todayStats.total)}
          {statCard('잔여 좌석', todayStats.remaining)}
          {statCard('취소', todayStats.cancelled, todayStats.cancelled > 0 ? 'text-orange-500' : 'text-gray-900')}
          {statCard('변경', todayStats.moved)}
          {statCard('미참석', todayStats.absent, todayStats.absent > 0 ? 'text-red-500' : 'text-gray-900')}
          {statCard('출결 미처리', pendingAttendance.length, pendingAttendance.length > 0 ? 'text-red-500' : 'text-gray-900')}
        </div>
        {Object.keys(todayStats.perProgram).length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {Object.entries(todayStats.perProgram).map(([pid, n]) => (
              <span key={pid} className="text-[11px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                {programName(pid)} {n}건
              </span>
            ))}
          </div>
        )}
      </section>

      {issueList('출결 미처리 (처리기한: 상담 다음 날 자정)', pendingAttendance, resLine, 'text-red-500')}
      {issueList('상담기록 기한 임박·작성 중', recordIssues.dueSoon, resLine, 'text-orange-500')}
      {issueList('상담기록 기한 초과', recordIssues.overdue, resLine, 'text-red-500')}

      {issueList('일정 이상', anomalies, (a) => (
        <div key={a.key} className="bg-white rounded-lg shadow-sm px-3 py-2 text-xs text-gray-600">{a.label}</div>
      ), 'text-orange-500')}

      {pendingAttendance.length === 0 && recordIssues.dueSoon.length === 0 &&
        recordIssues.overdue.length === 0 && anomalies.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">
          미처리 업무와 일정 이상이 없습니다.
        </p>
      )}
    </div>
  )
}
