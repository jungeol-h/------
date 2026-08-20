// 상담기록 작성 모달 — 기존 상담보고 6단계 공용 양식(CounselingContentFields) 재사용.
// 임시저장(draft)/작성완료(done) 분리. 기한 초과 작성은 저장을 막지 않고 표시만 한다 (명세 14.2).

import { useState } from 'react'
import ModalShell from '../../components/common/ModalShell.jsx'
import CounselingContentFields from '../../components/counseling/CounselingContentFields.jsx'
import { useBooking } from '../BookingContext.jsx'
import { addDaysStr, todayStrKst } from '../bookingRules.js'
import { RECORD_DEADLINE_DAYS } from '../bookingStatus.js'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

export default function RecordFormModal({ reservation, record, studentName, programName, groupMembers = [], onClose }) {
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
  // 실제 상담 시간 — 월간·컨설팅 보고서 집계가 예약 슬롯이 아닌 이 값을 쓴다
  // (2026-08-20 클라 요청). 기본값은 슬롯 시간이라 안 고치면 기존 집계와 동일.
  const [startTime, setStartTime] = useState(record?.startTime || reservation.slot?.startTime || '')
  const [endTime, setEndTime] = useState(record?.endTime || reservation.slot?.endTime || '')
  const [copyToGroup, setCopyToGroup] = useState(false) // 공통내용 전원 복사 (명세 11.5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const saveOne = (target, targetRecord, status) => saveRecord({
    id: targetRecord?.id,
    createdAt: targetRecord?.createdAt,
    reservationId: target.id,
    studentId: target.studentId,
    programId: target.programId,
    educatorId: target.slot?.educatorId ?? undefined,
    date: target.slot?.date ?? slotDate,
    status,
    startTime,
    endTime,
    ...fields,
  })

  const submit = async (status) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await saveOne(reservation, record, status)
      if (copyToGroup) {
        for (const m of groupMembers) {
          await saveOne(m.reservation, m.record, status)
        }
      }
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

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
          실제 상담 시간 <span className="text-gray-400">— 보고서 집계에 이 시간이 쓰입니다</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={FIELD}
            aria-label="실제 상담 시작 시간"
          />
          <span className="text-gray-400 text-sm">~</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={FIELD}
            aria-label="실제 상담 종료 시간"
          />
        </div>
      </div>

      <CounselingContentFields value={fields} onChange={setFields} fieldClass={FIELD} />

      {groupMembers.length > 0 && (
        <label className="flex items-start gap-2 text-sm text-gray-700 rounded-xl bg-purple-50 p-3">
          <input
            type="checkbox"
            checked={copyToGroup}
            onChange={(e) => setCopyToGroup(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            같은 그룹 {groupMembers.length}명({groupMembers.map((m) => m.name).join(', ')})의
            기록에도 동일 내용을 저장 — 저장 후 학생별로 특이사항을 덧붙일 수 있습니다.
          </span>
        </label>
      )}

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
