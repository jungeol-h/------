// 슬롯 일괄 삭제 모달 (슬롯 단위 + 날짜 단위 공용) — 2026-09-30 클라이언트 요청.
// AdminBookingView 타임테이블 메뉴(체크박스 선택 + 날짜 단위)·MySlotsPanel(날짜
// 헤더)에서 연다. 서버 `booking_delete_slots` RPC(add-booking-bulk-delete.sql)가
// 슬롯별 처리는 기존 booking_update_slot(p_delete)로 재사용하고 규칙 휴무일 등록·
// 과거 예약 이력 보호를 원자 처리한다 — 이 모달은 대상을 요약해 보여주고 사유를
// 받아 한 번에 호출한 뒤 결과를 안내하는 역할만 한다.

import { useMemo, useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import { useBooking } from '../BookingContext.jsx'
import { bookingMessage } from '../bookingMessages.js'
import { isSlotPast } from '../bookingStatus.js'

const SKIP_LABELS = {
  PAST_HAS_RESERVATIONS: '이미 진행된 예약이 있어 보호됨',
  ALREADY_CANCELLED: '이미 운영취소된 슬롯',
}

export default function BulkSlotDeleteModal({ slots, title = '슬롯 삭제', onClose, onDone }) {
  const { reservations, userNames, deleteSlots } = useBooking()

  // 이미 운영취소된 슬롯은 대상에서 제외 — 개수만 안내
  const alreadyCancelled = useMemo(() => slots.filter((s) => s.status === 'cancelled'), [slots])
  const targets = useMemo(() => slots.filter((s) => s.status !== 'cancelled'), [slots])
  const targetIds = useMemo(() => new Set(targets.map((s) => s.id)), [targets])

  const confirmedOf = (slotId) => reservations.filter((r) => r.slotId === slotId && r.status === 'confirmed')

  // 확정 예약이 있는 대상 슬롯 — 시작 전/후로 나눠 안내가 달라진다
  // confirmedOf는 reservations 파생 — targets/reservations와 함께 갱신되면 충분
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const withReservations = useMemo(() => targets.filter((s) => confirmedOf(s.id).length > 0), [targets, reservations])
  const pastWithReservations = useMemo(
    () => withReservations.filter((s) => isSlotPast(s)),
    [withReservations],
  )
  const futureWithReservations = useMemo(
    () => withReservations.filter((s) => !isSlotPast(s)),
    [withReservations],
  )
  const autoSlots = useMemo(() => targets.filter((s) => s.ruleId), [targets])

  // 미래 슬롯에 확정 예약이 있으면 취소될 예약 건수 — 안내·사유 필수 판단용
  const reservationsToCancel = useMemo(
    () => futureWithReservations.flatMap((s) => confirmedOf(s.id).map((r) => ({ r, slot: s }))),
    // confirmedOf는 reservations 파생 — futureWithReservations/reservations와 함께 갱신되면 충분
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [futureWithReservations, reservations],
  )
  const needsReason = reservationsToCancel.length > 0
  // 서버가 건너뛸 슬롯(지난 상담 이력 보호)을 뺀 실제 삭제 예정 수
  const deletableCount = targets.length - pastWithReservations.length

  const dates = useMemo(() => [...new Set(targets.map((s) => s.date))].sort(), [targets])

  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [failCode, setFailCode] = useState(null)
  const [result, setResult] = useState(null) // 성공 시 { deleted, soft, cancelled_reservations, excluded, skipped }

  const submit = async () => {
    if (busy || deletableCount === 0) return
    if (needsReason && !reason.trim()) {
      setFailCode('REASON_REQUIRED')
      return
    }
    setBusy(true)
    setFailCode(null)
    try {
      const res = await deleteSlots({
        slotIds: [...targetIds],
        reason: reason.trim() || null,
      })
      if (res?.ok) setResult(res)
      else setFailCode(res?.code ?? 'ERROR')
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    onClose()
    if (result) onDone?.()
  }

  // ─── 결과 화면 ───────────────────────────────────────────────
  if (result) {
    const skippedByCode = {}
    for (const s of result.skipped ?? []) {
      skippedByCode[s.code] = (skippedByCode[s.code] ?? 0) + 1
    }
    return (
      <ModalShell title={title} onClose={close}>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 space-y-1">
          <p className="text-sm font-bold text-emerald-700">삭제를 완료했습니다.</p>
          <p className="text-xs text-emerald-700">
            삭제 {result.deleted + result.soft}개
            {result.soft > 0 && ` (그중 예약 이력이 있어 운영취소로 남긴 ${result.soft}개)`}
          </p>
          {result.cancelled_reservations > 0 && (
            <p className="text-xs text-emerald-700">예약 취소 {result.cancelled_reservations}건</p>
          )}
          {(result.excluded ?? []).length > 0 && (
            <p className="text-xs text-emerald-700">휴무일 등록 {result.excluded.length}일</p>
          )}
        </div>
        {(result.skipped ?? []).length > 0 && (
          <div className="rounded-xl bg-gray-50 p-3 space-y-1">
            <p className="text-xs font-bold text-gray-600">건너뜀 {result.skipped.length}개</p>
            {Object.entries(skippedByCode).map(([code, count]) => (
              <p key={code} className="text-[11px] text-gray-500">
                {SKIP_LABELS[code] ?? code} {count}개
              </p>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={close}
          className="w-full h-11 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold"
        >
          닫기
        </button>
      </ModalShell>
    )
  }

  // ─── 확인 화면 ───────────────────────────────────────────────
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="rounded-xl bg-gray-50 p-3 space-y-0.5">
        <p className="text-sm font-bold text-gray-900">
          대상 {targets.length}개
          {dates.length > 0 && (
            <span className="ml-1.5 font-semibold text-gray-500">
              {dates[0]}{dates.length > 1 ? ` ~ ${dates[dates.length - 1]} (${dates.length}일)` : ''}
            </span>
          )}
        </p>
        {alreadyCancelled.length > 0 && (
          <p className="text-[11px] text-gray-400">이미 운영취소된 {alreadyCancelled.length}개는 대상에서 제외했습니다.</p>
        )}
      </div>

      {autoSlots.length > 0 && (
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 space-y-1">
          <p className="text-xs font-bold text-indigo-600">매주 반복(자동) 슬롯 {autoSlots.length}개 포함</p>
          <p className="text-[11px] text-indigo-500">
            그 날짜의 자동 슬롯을 모두 지우면 매주 반복의 휴무일로 등록되어 다시 생기지 않습니다.
          </p>
        </div>
      )}

      {pastWithReservations.length > 0 && (
        <div className="rounded-xl bg-gray-100 p-3 space-y-1">
          <p className="text-xs font-bold text-gray-600">
            이미 시작한 슬롯 중 확정 예약이 있는 {pastWithReservations.length}개
          </p>
          <p className="text-[11px] text-gray-500">지난 상담 이력 보호를 위해 삭제하지 않습니다.</p>
        </div>
      )}

      {withReservations.length > 0 && (
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 space-y-1">
          <p className="text-xs font-bold text-orange-600">확정 예약이 있는 슬롯 {withReservations.length}개</p>
          <div className="max-h-32 overflow-y-auto space-y-0.5">
            {withReservations.flatMap((s) => confirmedOf(s.id).map((r) => (
              <p key={r.id} className="text-[11px] text-orange-500">
                {userNames[r.studentId]?.name ?? r.studentId} · {s.date} {s.startTime}~{s.endTime}
              </p>
            )))}
          </div>
        </div>
      )}

      {needsReason && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 space-y-2">
          <p className="text-xs font-bold text-red-600">
            예약 {reservationsToCancel.length}건이 취소되고 학생·학부모에게 알림이 갑니다.
          </p>
          <label className="text-xs text-gray-500 block">
            삭제 사유 (필수)
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 강사 일정 변경"
              className="w-full mt-1 h-10 px-3 rounded-lg border border-gray-200 text-sm"
            />
          </label>
        </div>
      )}

      {!needsReason && withReservations.length === 0 && (
        <label className="text-xs text-gray-500 block">
          삭제 사유 (선택)
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 운영시간 조정"
            className="w-full mt-1 h-10 px-3 rounded-lg border border-gray-200 text-sm"
          />
        </label>
      )}

      {failCode && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(failCode)}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || deletableCount === 0}
        className="w-full h-11 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50"
      >
        {busy ? '삭제 중...' : `슬롯 ${deletableCount}개 삭제`}
      </button>
    </ModalShell>
  )
}
