// 출결 처리 모달 — 운영현황(BookingOpsDashboard) 미처리 카드·예약현황
// (ReservationSearch) [출결] 버튼에서 진입. 리스트에서 바로 출석/결석 처리 +
// 예약 변경·취소·상담기록 작성으로 이어지는 허브 (2026-08 클라이언트 요청).
// 강사/매니저 '예약현황' 메뉴도 같은 경로로 진입한다(2026-08-31) — 학생 상세
// 경로는 actor.role 기준. 같은 슬롯에 확정 예약이 여럿이면(그룹상담) 전원 참석
// 일괄 처리 버튼을 노출한다 (명세 11.5 — 일괄 후 개별 수정 가능).
//
// onChangeReservation·onCancelReservation·onWriteRecord는 부모가 이 모달을 닫고
// 각각의 모달(AdminChangeModal·AdminCancelModal·RecordFormModal)을 열도록 하는
// 콜백 — reservation을 인자로 넘긴다. 호출처 둘 다 BookingProvider 하위라
// setAttendance 등은 useBooking()으로 직접 취득한다.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ModalShell from '../../components/common/ModalShell.jsx'
import { useBooking } from '../BookingContext.jsx'
import { todayStr } from '../../utils/dateUtils.js'
import { bookingMessage } from '../bookingMessages.js'
import { ATTENDANCE_STATUS, ATTENDANCE_CHOICES, recordState } from '../bookingStatus.js'

const FIELD = 'h-10 px-3 rounded-lg border border-gray-200 text-sm'

// 참석·미참석은 첫 줄에 크게, 나머지(사전취소 등)는 아래 작게
const MAIN_CHOICES = ['attended', 'absent']
const SUB_CHOICES = ATTENDANCE_CHOICES.filter((k) => !MAIN_CHOICES.includes(k))

export default function AttendanceProcessModal({
  reservation: r, onClose, onChangeReservation, onCancelReservation, onWriteRecord,
}) {
  const { config, records, reservations, userNames, setAttendance, actor } = useBooking()
  const navigate = useNavigate()

  // 기존 메모가 있으면 미리 채워 재처리 시에도 유실되지 않게 한다
  const [note, setNote] = useState(r.attendanceNote ?? '')
  const [busy, setBusy] = useState(false)
  const [failCode, setFailCode] = useState(null)
  const [savedAttended, setSavedAttended] = useState(false) // 참석 처리 성공 → 기록 안내 화면

  const studentName = userNames[r.studentId]?.name ?? r.studentId
  const educatorName = userNames[r.slot?.educatorId]?.name ?? '미지정'
  const programName = config.programs.find((p) => p.id === r.programId)?.name ?? r.programId

  // 경과일수 — BookingOpsDashboard와 같은 계산 (명세 13.4)
  const daysSince = (() => {
    if (!r.slot?.date) return null
    const [y, m, d] = r.slot.date.split('-').map(Number)
    const [ty, tm, td] = todayStr().split('-').map(Number)
    return Math.round((new Date(ty, tm - 1, td) - new Date(y, m - 1, d)) / 86_400_000)
  })()

  // 이미 참석 처리됐는데 기록이 남은 예약(상담기록 임박·초과 리스트 진입)이면
  // 상담기록 작성 버튼을 처음부터 크게 노출한다
  const recState = recordState(r, records.find((x) => x.reservationId === r.id), r.slot?.date)
  const needsRecord = r.attendanceStatus === 'attended'
    && recState !== 'done' && recState !== 'done_overdue' && recState !== 'not_required'

  // 같은 슬롯의 다른 확정 예약 = 그룹상담 동반 인원
  const groupPeers = reservations.filter(
    (x) => x.slotId === r.slotId && x.id !== r.id && x.status === 'confirmed',
  )

  const mark = async (status) => {
    if (busy) return
    setBusy(true)
    setFailCode(null)
    try {
      const result = await setAttendance({ reservationId: r.id, status, note: note.trim() || null })
      if (!result?.ok) {
        setFailCode(result?.code ?? 'ERROR')
        return
      }
      // 참석 처리는 상담기록 작성 대상이 된다 — 안내 화면으로 전환.
      // 그 외 상태는 바로 닫는다 (afterWrite refetch로 미처리 리스트에서 자동 제거).
      if (status === 'attended') setSavedAttended(true)
      else onClose()
    } finally {
      setBusy(false)
    }
  }

  // 그룹 전원 참석 — 실패 시 중단하고 코드 표시 (성공 건은 처리된 상태로 남는다)
  const markAllAttended = async () => {
    if (busy) return
    setBusy(true)
    setFailCode(null)
    try {
      for (const target of [r, ...groupPeers]) {
        const result = await setAttendance({ reservationId: target.id, status: 'attended', note: note.trim() || null })
        if (!result?.ok) {
          setFailCode(result?.code ?? 'ERROR')
          return
        }
      }
      setSavedAttended(true)
    } finally {
      setBusy(false)
    }
  }

  const choiceBtn = (key, big) => {
    const current = r.attendanceStatus === key
    const tone = key === 'attended'
      ? (current ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-600 border-emerald-200')
      : key === 'absent'
        ? (current ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 text-red-500 border-red-200')
        : (current ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200')
    return (
      <button
        key={key}
        type="button"
        onClick={() => mark(key)}
        disabled={busy}
        className={`rounded-lg font-bold border disabled:opacity-50 ${big ? 'h-11 text-sm' : 'h-8 text-[11px]'} ${tone}`}
      >
        {ATTENDANCE_STATUS[key].label}
      </button>
    )
  }

  return (
    <ModalShell title="출결 처리" onClose={onClose}>
      {/* 예약 요약 */}
      <div className="rounded-xl bg-gray-50 p-3 space-y-1">
        <p className="text-sm font-bold text-gray-900">
          {studentName}
          <span className="ml-1.5 text-xs font-semibold text-gray-500">{programName}</span>
        </p>
        <p className="text-xs text-gray-500">
          {r.slot?.date} {r.slot?.startTime}~{r.slot?.endTime}
          {' · '}{educatorName}
          {daysSince !== null && ` · ${daysSince}일 경과`}
        </p>
        <p className="text-xs text-gray-500">
          현재 출결: <span className="font-bold">{ATTENDANCE_STATUS[r.attendanceStatus]?.label ?? r.attendanceStatus}</span>
          {r.attendanceOverdue ? ' · 기한초과' : ''}
        </p>
        {r.cancelReason && <p className="text-[11px] text-gray-400">취소사유: {r.cancelReason}</p>}
      </div>

      {savedAttended ? (
        <>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-700">
            참석 처리되었습니다. 이어서 상담기록을 작성할 수 있어요.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onWriteRecord(r)}
              className="flex-[2] h-12 rounded-xl bg-blue-500 text-white text-sm font-bold"
            >
              상담기록 작성
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold"
            >
              닫기
            </button>
          </div>
        </>
      ) : (
        <>
          {needsRecord && (
            <button
              type="button"
              onClick={() => onWriteRecord(r)}
              className="w-full h-12 rounded-xl bg-blue-500 text-white text-sm font-bold"
            >
              상담기록 작성 (참석 처리 완료)
            </button>
          )}
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              {MAIN_CHOICES.map((key) => choiceBtn(key, true))}
            </div>
            {groupPeers.length > 0 && (
              <button
                type="button"
                onClick={markAllAttended}
                disabled={busy}
                className="w-full h-9 rounded-lg bg-purple-600 text-white text-[11px] font-bold disabled:opacity-50"
              >
                그룹 전원 참석 처리 ({groupPeers.length + 1}명: {[r, ...groupPeers].map((x) => userNames[x.studentId]?.name ?? x.studentId).join(', ')})
              </button>
            )}
            <div className="grid grid-cols-4 gap-1.5">
              {SUB_CHOICES.map((key) => choiceBtn(key, false))}
            </div>
          </div>
          <label className="text-xs text-gray-500 block">
            사유 메모 (선택) — 특히 결석 처리 시 사유를 남겨 주세요
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${FIELD} w-full mt-1`}
              placeholder="예: 학부모 유선 통보 결석"
            />
          </label>
          {failCode && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">{bookingMessage(failCode)}</p>}
        </>
      )}

      {/* 보조 액션 — 기존 카드 클릭의 학생 상세 이동 기능 보존 */}
      <div className="space-y-2 pt-1 border-t border-gray-100">
        {!savedAttended && r.status === 'confirmed' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChangeReservation(r)}
              className="flex-1 h-8 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-bold"
            >
              예약 변경
            </button>
            <button
              type="button"
              onClick={() => onCancelReservation(r)}
              className="flex-1 h-8 rounded-lg bg-red-50 text-red-500 text-[11px] font-bold"
            >
              예약 취소
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate(`/${actor.role}/student/${r.studentId}`)}
          className="w-full h-8 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold"
        >
          학생 상세 보기
        </button>
      </div>
    </ModalShell>
  )
}
