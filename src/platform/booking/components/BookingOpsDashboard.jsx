// 관리자 운영현황 대시보드 — 명세 15.1·15.2.
// 당일 운영현황 + 미처리 업무(출결·기록) + 일정 이상 탐지. 전부 조회 시점 파생(저장 없음).

// 파생 계산은 React Compiler가 자동 메모이즈한다 — 수동 useMemo는 클로저 의존성
// 추론과 충돌해 컴파일 스킵을 유발하므로 쓰지 않는다.
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { todayStr } from '../../utils/dateUtils.js'
import { useBooking } from '../BookingContext.jsx'
import { useData } from '../../context/DataContext.jsx'
import { overlaps, todayStrKst } from '../bookingRules.js'
import { recordState } from '../bookingStatus.js'
import AttendanceProcessModal from './AttendanceProcessModal.jsx'
import { AdminCancelModal, AdminChangeModal } from './AdminReservationModals.jsx'
import RecordFormModal from './RecordFormModal.jsx'

export default function BookingOpsDashboard() {
  const { config, slots, reservations, records, userNames, slotCounts, cancel, change } = useBooking()
  const { data } = useData()
  const today = todayStr()

  // 미처리 카드 클릭 → 출결 처리 모달 → 변경·취소·상담기록 모달로 연결
  const [processTarget, setProcessTarget] = useState(null)
  const [changeTarget, setChangeTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [recordTarget, setRecordTarget] = useState(null)
  // 운영현황 블록 클릭 → 해당 건 상세목록 토글 (2026-08-31 클라이언트 요청)
  const [openStat, setOpenStat] = useState(null)

  const studentName = (id) => userNames[id]?.name ?? id
  const educatorName = (id) => userNames[id]?.name ?? (id ? id : '미지정')
  const programName = (id) => config.programs.find((p) => p.id === id)?.name ?? id

  // ─── 당일 운영현황 (명세 15.1) ──────────────────────────────
  // 블록별 상세목록에도 쓰므로 목록 자체를 컴포넌트 스코프에 둔다 (React Compiler 메모이즈).
  const todays = reservations
    .filter((r) => r.slot?.date === today)
    .sort((a, b) => (a.slot.startTime < b.slot.startTime ? -1 : 1))
  const todayConfirmed = todays.filter((r) => r.status === 'confirmed')
  const todayCancelled = todays.filter((r) => r.status === 'cancelled')
  const todayMoved = todays.filter((r) => r.status === 'moved')
  const todayAbsent = todayConfirmed.filter((r) => r.attendanceStatus === 'absent')
  const openSlotsToday = slots
    .filter((s) => s.date === today && s.status === 'open')
    .sort((a, b) => (a.startTime < b.startTime ? -1 : 1))
  const countBySlotToday = {}
  for (const r of todayConfirmed) {
    countBySlotToday[r.slotId] = (countBySlotToday[r.slotId] ?? 0) + 1
  }
  const fullSlotsToday = openSlotsToday.filter((s) => (countBySlotToday[s.id] ?? 0) >= s.capacity)
  const remainingSlotsToday = openSlotsToday.filter((s) => (countBySlotToday[s.id] ?? 0) < s.capacity)

  const todayStats = (() => {
    const perProgram = {}
    const perEducator = {}
    for (const r of todayConfirmed) {
      perProgram[r.programId] = (perProgram[r.programId] ?? 0) + 1
      const eid = r.slot?.educatorId
      if (eid) perEducator[eid] = (perEducator[eid] ?? 0) + 1
    }
    const seatTotal = openSlotsToday.reduce((sum, s) => sum + s.capacity, 0)
    return {
      total: todayConfirmed.length,
      perProgram,
      perEducator,
      fullSlots: fullSlotsToday.length,
      cancelled: todayCancelled.length,
      moved: todayMoved.length,
      absent: todayAbsent.length,
      remaining: Math.max(0, seatTotal - todayConfirmed.length),
    }
  })()

  // ─── 미처리 업무 ────────────────────────────────────────────
  // 상담이 실제로 이뤄진 흔적(예약 상담기록 done, 또는 같은 학생·같은 날짜의 일반
  // 상담기록)이 있으면 출결 미처리 목록에서 제외한다 — 출결 처리와 기록 작성이
  // 별도 경로라 "기록을 다 썼는데 계속 미처리로 뜬다"는 민원이 있었다 (2026-07-30).
  const kstToday = todayStrKst()
  const counselingRecords = data.counselingRecords ?? []
  const looksHandled = (r) => {
    if (records.some((x) => x.reservationId === r.id && x.status === 'done')) return true
    return counselingRecords.some((c) => c.studentId === r.studentId && c.date === r.slot.date)
  }
  const pendingAttendance = reservations
    .filter((r) => r.status === 'confirmed' && r.attendanceStatus === 'pending' && r.slot && r.slot.date < kstToday)
    .filter((r) => !looksHandled(r))
    .sort((a, b) => (a.slot.date < b.slot.date ? -1 : 1))

  const recordIssues = (() => {
    const dueSoon = []
    const overdue = []
    const unwrittenList = [] // 상담기록 미작성 전체 목록 (명세 15.1 — 블록 상세용)
    for (const r of reservations) {
      if (r.status !== 'confirmed' || r.attendanceStatus !== 'attended' || !r.slot) continue
      const state = recordState(r, records.find((x) => x.reservationId === r.id), r.slot.date)
      if (state !== 'done' && state !== 'done_overdue' && state !== 'not_required') unwrittenList.push(r)
      if (state === 'due_soon' || state === 'draft') dueSoon.push(r)
      else if (state === 'overdue') overdue.push(r)
    }
    unwrittenList.sort((a, b) => (a.slot.date < b.slot.date ? -1 : 1))
    return { dueSoon, overdue, unwrittenList, unwritten: unwrittenList.length }
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

  // 블록 클릭 → 상세목록 토글 (같은 블록 재클릭 시 닫힘)
  const statCard = (key, label, value, tone = 'text-gray-900') => (
    <button
      type="button"
      onClick={() => setOpenStat((cur) => (cur === key ? null : key))}
      className={`bg-white rounded-xl shadow-sm p-3 text-center ${
        openStat === key ? 'ring-2 ring-blue-300' : ''
      }`}
    >
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
    </button>
  )

  const issueList = (title, items, render, tone) => items.length > 0 && (
    <section className="space-y-1.5">
      <h4 className={`text-xs font-bold ${tone}`}>{title} ({items.length})</h4>
      {items.slice(0, 10).map(render)}
      {items.length > 10 && <p className="text-[11px] text-gray-400">외 {items.length - 10}건</p>}
    </section>
  )

  // 경과일수 (명세 13.4)
  const daysSince = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const [ty, tm, td] = today.split('-').map(Number)
    return Math.round((new Date(ty, tm - 1, td) - new Date(y, m - 1, d)) / 86_400_000)
  }

  // 누르면 출결 처리 모달 — 출결·변경·취소·상담기록·학생 상세를 한곳에서
  // (2026-08 클라이언트 요청, 기존 학생 상세 이동은 모달 내 버튼으로 보존)
  const resLine = (r) => (
    <button
      key={r.id}
      type="button"
      onClick={() => setProcessTarget(r)}
      className="w-full bg-white rounded-lg shadow-sm px-3 py-2 text-xs text-gray-600 flex items-center justify-between gap-2 text-left hover:bg-blue-50/50"
    >
      <span>{r.slot.date} {r.slot.startTime} · {studentName(r.studentId)} · {programName(r.programId)}</span>
      <span className="text-gray-400 flex-shrink-0 flex items-center gap-0.5">
        {educatorName(r.slot.educatorId)} · {daysSince(r.slot.date) === 0 ? '오늘' : `${daysSince(r.slot.date)}일 경과`}
        <ChevronRight size={14} />
      </span>
    </button>
  )

  // 취소·변경 등 처리 액션이 없는 예약 행 (사유 표시)
  const resStatic = (r) => (
    <div key={r.id} className="bg-white rounded-lg shadow-sm px-3 py-2 text-xs text-gray-600 space-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <span>{r.slot.startTime} · {studentName(r.studentId)} · {programName(r.programId)}</span>
        <span className="text-gray-400 flex-shrink-0">{educatorName(r.slot.educatorId)}</span>
      </div>
      {r.cancelReason && <p className="text-[11px] text-gray-400">취소사유: {r.cancelReason}</p>}
    </div>
  )

  // 슬롯 행 — 잔여/마감 좌석 현황
  const slotLine = (s) => {
    const booked = countBySlotToday[s.id] ?? 0
    return (
      <div key={s.id} className="bg-white rounded-lg shadow-sm px-3 py-2 text-xs text-gray-600 flex items-center justify-between gap-2">
        <span>{s.startTime}~{s.endTime} · {programName(s.programId)} · {educatorName(s.educatorId)}</span>
        <span className={`flex-shrink-0 font-bold ${booked >= s.capacity ? 'text-red-400' : 'text-emerald-500'}`}>
          {booked >= s.capacity ? `마감 ${booked}/${s.capacity}` : `잔여 ${s.capacity - booked}/${s.capacity}`}
        </span>
      </div>
    )
  }

  // 블록별 상세목록 정의 — items가 예약이면 클릭 시 출결 처리 모달로 이어진다
  const STAT_DETAILS = {
    total: { title: '오늘 확정 예약', items: todayConfirmed, render: resLine },
    remaining: { title: '오늘 잔여 좌석 슬롯', items: remainingSlotsToday, render: slotLine },
    fullSlots: { title: '오늘 마감 슬롯', items: fullSlotsToday, render: slotLine },
    cancelled: { title: '오늘 취소', items: todayCancelled, render: resStatic },
    moved: { title: '오늘 변경', items: todayMoved, render: resStatic },
    absent: { title: '오늘 미참석', items: todayAbsent, render: resLine },
    pending: { title: '출결 미처리 전체', items: pendingAttendance, render: resLine },
    unwritten: { title: '상담기록 미작성 전체', items: recordIssues.unwrittenList, render: resLine },
  }
  const openDetail = openStat ? STAT_DETAILS[openStat] : null

  return (
    <div className="space-y-5">
      <section>
        <h4 className="text-xs font-bold text-gray-400 mb-2">오늘 운영현황 ({today})</h4>
        <div className="grid grid-cols-4 gap-2">
          {statCard('total', '오늘 예약', todayStats.total)}
          {statCard('remaining', '잔여 좌석', todayStats.remaining)}
          {statCard('fullSlots', '마감 슬롯', todayStats.fullSlots)}
          {statCard('cancelled', '취소', todayStats.cancelled, todayStats.cancelled > 0 ? 'text-orange-500' : 'text-gray-900')}
          {statCard('moved', '변경', todayStats.moved)}
          {statCard('absent', '미참석', todayStats.absent, todayStats.absent > 0 ? 'text-red-500' : 'text-gray-900')}
          {statCard('pending', '출결 미처리', pendingAttendance.length, pendingAttendance.length > 0 ? 'text-red-500' : 'text-gray-900')}
          {statCard('unwritten', '기록 미작성', recordIssues.unwritten, recordIssues.unwritten > 0 ? 'text-orange-500' : 'text-gray-900')}
        </div>
        {openDetail && (
          <div className="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-2 space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-bold text-gray-500">{openDetail.title} ({openDetail.items.length}건)</p>
              <button
                type="button"
                onClick={() => setOpenStat(null)}
                className="text-[11px] font-bold text-gray-400"
              >
                닫기
              </button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {openDetail.items.map(openDetail.render)}
              {openDetail.items.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-400">해당 건이 없습니다.</p>
              )}
            </div>
          </div>
        )}
        {(Object.keys(todayStats.perProgram).length > 0 || Object.keys(todayStats.perEducator).length > 0) && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {Object.entries(todayStats.perProgram).map(([pid, n]) => (
              <span key={pid} className="text-[11px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600">
                {programName(pid)} {n}건
              </span>
            ))}
            {Object.entries(todayStats.perEducator).map(([eid, n]) => (
              <span key={eid} className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">
                {educatorName(eid)} {n}건
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

      {processTarget && (
        <AttendanceProcessModal
          reservation={processTarget}
          onClose={() => setProcessTarget(null)}
          onChangeReservation={(r) => { setProcessTarget(null); setChangeTarget(r) }}
          onCancelReservation={(r) => { setProcessTarget(null); setCancelTarget(r) }}
          onWriteRecord={(r) => { setProcessTarget(null); setRecordTarget(r) }}
        />
      )}
      {changeTarget && (
        <AdminChangeModal
          reservation={changeTarget}
          studentName={studentName(changeTarget.studentId)}
          slots={slots}
          slotCounts={slotCounts}
          reservations={reservations}
          userNames={userNames}
          change={change}
          onClose={() => setChangeTarget(null)}
        />
      )}
      {cancelTarget && (
        <AdminCancelModal
          reservation={cancelTarget}
          studentName={studentName(cancelTarget.studentId)}
          cancel={cancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
      {recordTarget && (
        <RecordFormModal
          reservation={recordTarget}
          record={records.find((x) => x.reservationId === recordTarget.id)}
          studentName={studentName(recordTarget.studentId)}
          programName={programName(recordTarget.programId)}
          groupMembers={reservations
            .filter((x) => x.slotId === recordTarget.slotId && x.id !== recordTarget.id
              && x.status === 'confirmed' && x.attendanceStatus === 'attended' && x.slot)
            .map((x) => ({
              reservation: x,
              record: records.find((rr) => rr.reservationId === x.id),
              name: studentName(x.studentId),
            }))}
          onClose={() => setRecordTarget(null)}
        />
      )}
    </div>
  )
}
