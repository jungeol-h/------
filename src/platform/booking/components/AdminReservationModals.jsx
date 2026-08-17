// 관리자 예약 조작 모달 모음 — ReservationSearch에서 추출.
// AdminSlotGrid·OverrideFields(공용 헬퍼) + AdminCancelModal·AdminChangeModal.
// ReservationSearch(예약현황)와 BookingOpsDashboard(운영현황 출결 처리)가 공용한다.
// 예외(override) 처리는 반드시 사유를 입력해야 하며, RPC가 감사이력에 남긴다.

import { useMemo, useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { bookingMessage } from '../bookingMessages.js'
import WeeklySlotPicker from './WeeklySlotPicker.jsx'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

// 관리자 슬롯 선택 그리드 (대리 예약·변경 공용) — 학생 화면과 같은 주간 그리드.
// 마감 셀도 탭 가능(정원 초과는 예외 처리 토글 + RPC 판단), 같은 시간 복수 강사는
// 인라인 목록으로 고른다. studentReservations로 대상 학생의 '내예약' 셀도 표시.
export function AdminSlotGrid({ slots, slotCounts, programId, studentReservations, userNames, onPick }) {
  const [chooser, setChooser] = useState(null)
  const candidates = useMemo(
    () => slots.filter((s) =>
      s.programId === programId && s.date >= todayStr() && s.status !== 'cancelled'),
    [slots, programId],
  )
  if (candidates.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">선택 가능한 슬롯이 없습니다.</p>
  }
  return (
    <div className="space-y-2">
      <WeeklySlotPicker
        slots={candidates}
        slotCounts={slotCounts}
        myReservations={studentReservations}
        onPick={(s) => { setChooser(null); onPick(s) }}
        onPickMany={setChooser}
        adminMode
      />
      {chooser && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2 space-y-1">
          <p className="text-[11px] font-bold text-blue-600 px-1">
            {chooser[0].date} {chooser[0].startTime} — 강사 선택
          </p>
          {chooser.map((s) => {
            const count = slotCounts[s.id] ?? 0
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { setChooser(null); onPick(s) }}
                className="w-full rounded-lg bg-white border border-gray-200 px-3 py-2 text-left text-xs flex justify-between"
              >
                <span>{userNames[s.educatorId]?.name ?? '미지정'}{s.status !== 'open' ? ` · ${s.status}` : ''}</span>
                <span className={count >= s.capacity ? 'text-red-500 font-bold' : 'text-gray-400'}>
                  {count}/{s.capacity}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function OverrideFields({ override, setOverride, reason, setReason, reasonRequired }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
        예외 처리 (정원·횟수·기한 제한 무시)
      </label>
      <label className="text-xs text-gray-500 block">
        처리 사유 {override || reasonRequired ? '(필수)' : '(선택)'}
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={`${FIELD} w-full mt-1`}
          placeholder="예: 학부모 유선 요청"
        />
      </label>
    </div>
  )
}

export function AdminCancelModal({ reservation, studentName, cancel, onClose }) {
  const [reason, setReason] = useState('')
  const [failCode, setFailCode] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    if (!reason.trim()) {
      setFailCode('REASON_REQUIRED')
      return
    }
    setBusy(true)
    try {
      const result = await cancel({ reservationId: reservation.id, reason: reason.trim() })
      if (result?.ok) onClose()
      else setFailCode(result?.code ?? 'ERROR')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="관리자 취소" onClose={onClose}>
      <p className="text-sm text-gray-600">
        {studentName} · {reservation.slot?.date} {reservation.slot?.startTime} 예약을 취소합니다.
        기한과 무관하게 처리되며 사유가 기록됩니다.
      </p>
      <label className="text-xs text-gray-500 block">
        취소 사유 (필수)
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={`${FIELD} w-full mt-1`} />
      </label>
      {failCode && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(failCode)}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="w-full h-12 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50"
      >
        {busy ? '처리 중...' : '취소 확정'}
      </button>
    </ModalShell>
  )
}

export function AdminChangeModal({ reservation, studentName, slots, slotCounts, reservations, userNames, change, onClose }) {
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [override, setOverride] = useState(false)
  const [reason, setReason] = useState('')
  const [failCode, setFailCode] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!selectedSlot || busy) return
    if (!reason.trim()) {
      setFailCode('REASON_REQUIRED')
      return
    }
    setBusy(true)
    try {
      const result = await change({
        reservationId: reservation.id, newSlotId: selectedSlot.id, override, reason: reason.trim(),
      })
      if (result?.ok) onClose()
      else setFailCode(result?.code ?? 'ERROR')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="관리자 예약 변경" onClose={onClose} maxWidth="max-w-xl">
      <p className="text-sm text-gray-600">
        {studentName} · 기존 {reservation.slot?.date} {reservation.slot?.startTime} → 새 시간을 선택하세요.
      </p>
      <OverrideFields override={override} setOverride={setOverride} reason={reason} setReason={setReason} reasonRequired />
      {failCode && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(failCode)}</p>}
      <AdminSlotGrid
        slots={slots}
        slotCounts={slotCounts}
        programId={reservation.programId}
        studentReservations={reservations.filter((r) => r.studentId === reservation.studentId)}
        userNames={userNames}
        onPick={(s) => { setSelectedSlot(s); setFailCode(null) }}
      />
      {selectedSlot && (
        <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-2 font-medium">
          새 시간: {selectedSlot.date} {selectedSlot.startTime}~{selectedSlot.endTime}
          {' · '}{userNames[selectedSlot.educatorId]?.name ?? '미지정'}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!selectedSlot || busy}
        className="w-full h-12 rounded-xl bg-blue-500 text-white font-bold disabled:opacity-50"
      >
        {busy ? '처리 중...' : '이 시간으로 변경'}
      </button>
    </ModalShell>
  )
}
