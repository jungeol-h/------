// 슬롯 편집 모달 (강사·관리자 공용) — 명세 10.2·10.3.
// 예약이 없는 슬롯: 시간·정원·공개·상태 자유 편집, 삭제 가능.
// 예약이 있는 슬롯: 영향 학생 목록 표시 + 변경사유 필수, 삭제 불가(운영취소 전환만).
// 최종 검증·감사·영향자 알림은 booking_update_slot RPC가 원자 처리한다.

import { useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import TimeField from '../../components/common/TimeField.jsx'
import { useBooking } from '../BookingContext.jsx'
import { bookingMessage } from '../bookingMessages.js'
import { SLOT_STATUS } from '../bookingStatus.js'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

export default function SlotEditorModal({ slot, program, onClose, isAdmin = false }) {
  const { reservations, userNames, updateSlot } = useBooking()
  const affected = reservations.filter((r) => r.slotId === slot.id && r.status === 'confirmed')

  const [form, setForm] = useState({
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    capacity: slot.capacity,
    status: slot.status,
    isPublic: slot.isPublic,
    note: slot.note ?? '',
  })
  const [reason, setReason] = useState('')
  const [failCode, setFailCode] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const setTime = (key) => (v) => setForm((f) => ({ ...f, [key]: v }))
  const needsReason = affected.length > 0

  const submit = async (del = false) => {
    if (busy) return
    if (needsReason && !reason.trim()) {
      setFailCode('REASON_REQUIRED')
      return
    }
    setBusy(true)
    try {
      const result = await updateSlot({
        slotId: slot.id,
        del,
        reason: reason.trim() || null,
        patch: del ? {} : {
          date: form.date,
          start_time: form.startTime,
          end_time: form.endTime,
          capacity: Number(form.capacity),
          status: form.status,
          is_public: form.isPublic,
          note: form.note,
        },
      })
      if (result?.ok) {
        onClose()
      } else {
        setFailCode(result?.code ?? 'ERROR')
      }
    } finally {
      setBusy(false)
    }
  }

  const statusOptions = Object.keys(SLOT_STATUS).filter(
    (s) => isAdmin || s !== 'done', // 운영종료 수동 전환은 관리자만
  )

  return (
    <ModalShell title={`슬롯 편집 — ${program?.name ?? ''}`} onClose={onClose}>
      {needsReason && (
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-3 space-y-1">
          <p className="text-xs font-bold text-orange-600">
            이 시간에 예약된 학생 {affected.length}명이 있습니다. 변경 시 학생·학부모에게 알림이 발송됩니다.
          </p>
          <p className="text-xs text-orange-500">
            {affected.map((r) => userNames[r.studentId]?.name ?? r.studentId).join(', ')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500 col-span-2">
          날짜
          <input type="date" value={form.date} onChange={set('date')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          시작
          <TimeField value={form.startTime} onChange={setTime('startTime')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          종료
          <TimeField value={form.endTime} onChange={setTime('endTime')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          정원
          <input type="number" min="1" value={form.capacity} onChange={set('capacity')} className={`${FIELD} w-full mt-1`} />
        </label>
        <label className="text-xs text-gray-500">
          상태
          <select value={form.status} onChange={set('status')} className={`${FIELD} w-full mt-1`}>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{SLOT_STATUS[s].label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500 col-span-2 flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
          />
          학생 예약 목록에 공개
        </label>
        <label className="text-xs text-gray-500 col-span-2">
          비고
          <input type="text" value={form.note} onChange={set('note')} className={`${FIELD} w-full mt-1`} />
        </label>
      </div>

      {(needsReason || form.status === 'cancelled') && (
        <label className="text-xs text-gray-500 block">
          변경사유 (필수)
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 강사 일정 변경"
            className={`${FIELD} w-full mt-1`}
          />
        </label>
      )}

      {failCode && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(failCode)}</p>
      )}

      <div className="flex gap-2">
        {affected.length === 0 && (
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={busy}
            className="flex-1 h-11 rounded-xl bg-red-50 text-red-500 text-sm font-bold disabled:opacity-50"
          >
            슬롯 삭제
          </button>
        )}
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={busy}
          className="flex-[2] h-11 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {busy ? '처리 중...' : '저장'}
        </button>
      </div>
    </ModalShell>
  )
}
