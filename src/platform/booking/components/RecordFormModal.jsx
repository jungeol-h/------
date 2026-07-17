// 상담기록 작성 모달 — 기존 상담보고 6단계 공용 양식(CounselingContentFields) 재사용.
// 임시저장(draft)/작성완료(done) 분리. 기한 초과 작성은 저장을 막지 않고 표시만 한다 (명세 14.2).

import { useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import CounselingContentFields from '../../components/counseling/CounselingContentFields.jsx'
import { useBooking } from '../BookingContext.jsx'
import { addDaysStr, todayStrKst } from '../bookingRules.js'
import { RECORD_DEADLINE_DAYS } from '../bookingStatus.js'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

export default function RecordFormModal({ reservation, record, studentName, programName, onClose }) {
  const { saveRecord } = useBooking()
  const slotDate = reservation.slot?.date ?? reservation.createdAt?.slice(0, 10)
  const deadline = addDaysStr(slotDate, RECORD_DEADLINE_DAYS)
  const overdue = todayStrKst() > deadline

  const [fields, setFields] = useState({
    topic: record?.topic ?? '',
    diagnosis: record?.diagnosis ?? '',
    advice: record?.advice ?? '',
    followUp: record?.followUp ?? '',
    note: record?.note ?? '',
    nextAppointment: record?.nextAppointment ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (status) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await saveRecord({
        id: record?.id,
        createdAt: record?.createdAt,
        reservationId: reservation.id,
        studentId: reservation.studentId,
        programId: reservation.programId,
        educatorId: reservation.slot?.educatorId ?? undefined,
        date: slotDate,
        status,
        ...fields,
      })
      onClose()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title={`상담기록 — ${studentName}`} onClose={onClose} maxWidth="max-w-xl">
      <div className="text-xs text-gray-500 space-y-0.5">
        <p>{programName} · {slotDate} {reservation.slot?.startTime}~{reservation.slot?.endTime}</p>
        <p className={overdue ? 'text-red-500 font-bold' : ''}>
          작성기한: {deadline} 23:59{overdue ? ' — 기한 초과 작성으로 기록됩니다' : ''}
        </p>
      </div>

      <CounselingContentFields value={fields} onChange={setFields} fieldClass={FIELD} />

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">저장에 실패했습니다. 다시 시도해 주세요.</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => submit('draft')}
          disabled={busy}
          className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold disabled:opacity-50"
        >
          임시저장
        </button>
        <button
          type="button"
          onClick={() => submit('done')}
          disabled={busy}
          className="flex-[2] h-11 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
        >
          {busy ? '저장 중...' : '작성 완료'}
        </button>
      </div>
    </ModalShell>
  )
}
