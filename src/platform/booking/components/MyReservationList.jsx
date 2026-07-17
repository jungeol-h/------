// 내 예약 목록 — 예정·지난·취소 구분, 변경/취소 버튼(기한 지나면 비활성 + 안내문).
import { useMemo, useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { useBooking } from '../BookingContext.jsx'
import { deadlineOk } from '../bookingRules.js'
import { bookingMessage } from '../bookingMessages.js'
import { reservationDisplayStatus, recordState, RECORD_STATE } from '../bookingStatus.js'

// 취소사유 선택지 (명세 9.3)
const CANCEL_REASONS = ['개인 일정', '학교·학원 일정', '건강 문제', '예약 착오', '기타']

export default function MyReservationList({ reservations, programs, subjects, userNames, onStartChange }) {
  const { records, cancel } = useBooking()
  const [cancelling, setCancelling] = useState(null)
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [etcReason, setEtcReason] = useState('')
  const [failCode, setFailCode] = useState(null)
  const [busy, setBusy] = useState(false)

  const today = todayStr()
  const groups = useMemo(() => {
    const sorted = reservations
      .filter((r) => r.slot)
      .sort((a, b) => (a.slot.date === b.slot.date
        ? (a.slot.startTime < b.slot.startTime ? -1 : 1)
        : a.slot.date < b.slot.date ? -1 : 1))
    return {
      upcoming: sorted.filter((r) => r.status === 'confirmed' && r.slot.date >= today),
      past: sorted.filter((r) => r.status === 'confirmed' && r.slot.date < today).reverse(),
      cancelled: sorted.filter((r) => r.status !== 'confirmed').reverse(),
    }
  }, [reservations, today])

  const programOf = (r) => programs.find((p) => p.id === r.programId)
  const subjectName = (id) => subjects.find((s) => s.id === id)?.name ?? ''

  const submitCancel = async () => {
    if (!cancelling || busy) return
    const finalReason = reason === '기타' ? (etcReason.trim() || '기타') : reason
    setBusy(true)
    try {
      const result = await cancel({ reservationId: cancelling.id, reason: finalReason })
      if (result?.ok) {
        setCancelling(null)
        setFailCode(null)
      } else {
        setFailCode(result?.code ?? 'ERROR')
      }
    } finally {
      setBusy(false)
    }
  }

  const renderItem = (r, { withActions = false } = {}) => {
    const program = programOf(r)
    const display = reservationDisplayStatus(r, r.slot)
    const canOnline = program && r.slot && deadlineOk(program, r.slot)
    const rec = records.find((x) => x.reservationId === r.id)
    const recState = r.slot ? recordState(r, rec, r.slot.date) : 'not_required'
    return (
      <div key={r.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {program?.name ?? '프로그램'}
              {r.slot?.subjectId && <span className="ml-1.5 text-xs text-emerald-600">{subjectName(r.slot.subjectId)}</span>}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {r.slot?.date} {r.slot?.startTime}~{r.slot?.endTime}
              {' · '}{userNames[r.slot?.educatorId]?.name ?? '담당 미정'}
            </p>
          </div>
          <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
            {display.label}
          </span>
        </div>

        {r.status === 'confirmed' && r.slot?.date < today && (
          <p className="text-[11px] text-gray-400">
            상담기록: {RECORD_STATE[recState]?.label ?? recState}
          </p>
        )}
        {r.cancelReason && (
          <p className="text-[11px] text-gray-400">취소사유: {r.cancelReason}</p>
        )}

        {withActions && (
          canOnline ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onStartChange(r)}
                className="flex-1 h-9 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold"
              >
                예약 변경
              </button>
              <button
                type="button"
                onClick={() => { setCancelling(r); setFailCode(null); setReason(CANCEL_REASONS[0]); setEtcReason('') }}
                className="flex-1 h-9 rounded-lg bg-red-50 text-red-500 text-xs font-bold"
              >
                예약 취소
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-orange-500 bg-orange-50 rounded-lg p-2">
              {bookingMessage('DEADLINE_PASSED', { program: programOf(r) })}
            </p>
          )
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-gray-400">예정된 예약</h3>
        {groups.upcoming.length === 0
          ? <p className="py-6 text-center text-sm text-gray-400 bg-white rounded-2xl shadow-sm">예정된 예약이 없습니다.</p>
          : groups.upcoming.map((r) => renderItem(r, { withActions: true }))}
      </section>
      {groups.past.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-gray-400">지난 예약</h3>
          {groups.past.map((r) => renderItem(r))}
        </section>
      )}
      {groups.cancelled.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-gray-400">취소·변경된 예약</h3>
          {groups.cancelled.map((r) => renderItem(r))}
        </section>
      )}

      {cancelling && (
        <ModalShell title="예약 취소" onClose={() => setCancelling(null)}>
          <p className="text-sm text-gray-600">
            {cancelling.slot?.date} {cancelling.slot?.startTime} 예약을 취소할까요?
          </p>
          <div className="space-y-1.5">
            {CANCEL_REASONS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="cancel-reason"
                  checked={reason === option}
                  onChange={() => setReason(option)}
                />
                {option}
              </label>
            ))}
            {reason === '기타' && (
              <input
                type="text"
                value={etcReason}
                onChange={(e) => setEtcReason(e.target.value)}
                placeholder="사유를 입력해 주세요"
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm"
              />
            )}
          </div>
          {failCode && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">
              {bookingMessage(failCode, { program: programOf(cancelling) })}
            </p>
          )}
          <button
            type="button"
            onClick={submitCancel}
            disabled={busy}
            className="w-full h-12 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50"
          >
            {busy ? '처리 중...' : '취소 확정'}
          </button>
        </ModalShell>
      )}
    </div>
  )
}
